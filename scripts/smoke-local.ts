// End-to-end smoke test of the whole API flow on the Firebase Emulator (no Google Cloud, and no Gemini calls when GEMINI_MOCK=true).
// Needs: `npm run emulators` running + the app running (npm run dev:local, or the standalone build).
// Run:   npm run smoke:local                 (defaults to http://localhost:3000)
//        npm run smoke:local -- http://localhost:3100
import { readFileSync } from 'node:fs';
import { adminDb } from '@/lib/firebase-admin';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`;

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` – ${detail}` : ''}`);
};

/** Create an anonymous user on the Auth Emulator, set its role with the Admin SDK, return an ID token. */
async function makeUser(role: 'staff' | 'manager', name: string): Promise<{ uid: string; token: string }> {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const { localId, idToken } = (await res.json()) as { localId: string; idToken: string };
  await adminDb().doc(`users/${localId}`).set({ role, displayName: name, isDemo: true });
  return { uid: localId, token: idToken };
}

async function call(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const res = await fetch(BASE + path, { ...init, headers });
  const isJson = res.headers.get('content-type')?.includes('json');
  return { status: res.status, body: (isJson ? await res.json() : await res.arrayBuffer()) as Record<string, unknown> };
}

async function main() {
  const health = await call('/api/health', null);
  check('GET /api/health', health.status === 200 && health.body.ok === true, `model=${health.body.model} mock=${health.body.mock}`);

  const staff = await makeUser('staff', 'Smoke Staff');
  const other = await makeUser('staff', 'Smoke Staff 2');
  const manager = await makeUser('manager', 'Smoke Manager');

  check('Anonymous request is rejected', (await call('/api/packages/from-sample', null, { method: 'POST', body: '{}' })).status === 401);
  check('Manager cannot create a package', (await call('/api/packages/from-sample', manager.token, { method: 'POST', body: JSON.stringify({ sampleId: 's2-errors' }) })).status === 403);

  const t0 = Date.now();
  const created = await call('/api/packages/from-sample', staff.token, { method: 'POST', body: JSON.stringify({ sampleId: 's2-errors' }) });
  const id = created.body.id as string;
  check('Create a package from sample s2-errors', created.status === 200 && Boolean(id), `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!id) throw new Error(`Could not create the package: ${JSON.stringify(created.body)}`);

  const pkg = (await adminDb().doc(`packages/${id}`).get()).data()!;
  check('v1 result: 60 pts, pending review', pkg.status === 'pending_review' && pkg.riskScore === 60, `status=${pkg.status} score=${pkg.riskScore}`);
  const findings = await adminDb().collection(`packages/${id}/findings`).get();
  check('3 findings: C2, C3, C5', findings.docs.map((d) => d.get('checkId')).sort().join(',') === 'C2,C3,C5');

  const pdf = await call(`/api/files/${id}/invoice`, staff.token);
  check('Owner can download the PDF', pdf.status === 200 && (pdf.body as unknown as ArrayBuffer).byteLength > 1000);
  check('Another user cannot download the PDF', (await call(`/api/files/${id}/invoice`, other.token)).status === 403);

  check('Staff cannot make a decision', (await call(`/api/packages/${id}/decision`, staff.token, { method: 'POST', body: JSON.stringify({ action: 'approve' }) })).status === 403);
  check('A fix request must have a comment', (await call(`/api/packages/${id}/decision`, manager.token, { method: 'POST', body: JSON.stringify({ action: 'request_fix', comment: '' }) })).status === 400);
  const fix = await call(`/api/packages/${id}/decision`, manager.token, { method: 'POST', body: JSON.stringify({ action: 'request_fix', comment: 'Fix the unit price and the VAT amount' }) });
  check('Manager requests a fix', fix.status === 200);

  const form = new FormData();
  form.set('invoice', new Blob([readFileSync('public/samples/s2-fixed/invoice.pdf')], { type: 'application/pdf' }), 'invoice.pdf');
  form.set('invoiceXml', new Blob([readFileSync('public/samples/s2-fixed/invoice.xml')], { type: 'application/xml' }), 'invoice.xml');
  check('Another user cannot resubmit', (await call(`/api/packages/${id}/resubmit`, other.token, { method: 'POST', body: form })).status === 403);
  const resub = await call(`/api/packages/${id}/resubmit`, staff.token, { method: 'POST', body: form });
  const v2 = (await adminDb().doc(`packages/${id}`).get()).data()!;
  check('Resubmit → v2: 0 pts', resub.status === 200 && v2.version === 2 && v2.riskScore === 0, `status=${v2.status} score=${v2.riskScore}`);

  const approve = await call(`/api/packages/${id}/decision`, manager.token, { method: 'POST', body: JSON.stringify({ action: 'approve', comment: '' }) });
  check('Manager approves', approve.status === 200);
  check('A second decision is rejected (409)', (await call(`/api/packages/${id}/decision`, manager.token, { method: 'POST', body: JSON.stringify({ action: 'approve' }) })).status === 409);

  const audit = await adminDb().collection('audit_log').where('packageId', '==', id).get();
  const actions = audit.docs.map((d) => d.get('action') as string).sort();
  check('Audit log has all 6 events', audit.size === 6, actions.join(', '));

  const bad = new FormData();
  bad.set('contract', new Blob(['not a pdf'], { type: 'application/pdf' }), 'x.pdf');
  check('Missing or malformed files are rejected', (await call('/api/packages', staff.token, { method: 'POST', body: bad })).status === 400);

  console.log(failed ? `\n❌ ${failed} check(s) FAILED` : '\n✅ All PASS');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
