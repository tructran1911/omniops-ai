import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { saveFile } from './storage';
import { audit } from './audit';
import { HttpError, type CurrentUser } from './auth-server';
import { runPipeline } from './pipeline/run';
import { sha256 } from './pipeline/hash';
import type { DocRef, DocType, PackageDoc } from '@/types/domain';

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_PDF_PAGES = 15;
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR ?? 10);
const ALL_TYPES: DocType[] = ['contract', 'acceptance', 'invoice', 'invoiceXml'];

export type IncomingFile = { fileName: string; data: Buffer };
export type IncomingFiles = Partial<Record<DocType, IncomingFile>>;

/** Read the uploaded files out of FormData; empty slots are skipped. */
export async function filesFromForm(form: FormData): Promise<IncomingFiles> {
  const out: IncomingFiles = {};
  for (const t of ALL_TYPES) {
    const f = form.get(t);
    if (f instanceof File && f.size > 0) out[t] = { fileName: f.name, data: Buffer.from(await f.arrayBuffer()) };
  }
  return out;
}

/** Validate file type, size and page count. */
export function validateFiles(files: IncomingFiles, requireAllPdfs: boolean) {
  if (requireAllPdfs && (!files.contract || !files.acceptance || !files.invoice)) {
    throw new HttpError(400, 'All three PDFs are required: contract, acceptance record and invoice');
  }
  if (!requireAllPdfs && Object.keys(files).length === 0) throw new HttpError(400, 'Pick at least one file to resubmit');
  for (const [type, f] of Object.entries(files) as [DocType, IncomingFile][]) {
    if (f.data.length > MAX_FILE_BYTES) throw new HttpError(400, `File "${f.fileName}" is larger than 4 MB`);
    if (type === 'invoiceXml') {
      if (!f.data.subarray(0, 200).toString('utf-8').includes('<')) throw new HttpError(400, 'The e-invoice file must be XML');
      continue;
    }
    if (f.data.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(400, `File "${f.fileName}" is not a PDF`);
    const pages = (f.data.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    if (pages > MAX_PDF_PAGES) throw new HttpError(400, `File "${f.fileName}" has ${pages} pages; the limit is ${MAX_PDF_PAGES}`);
  }
}

/** Cap the number of analyses per user per hour (protects the Gemini quota). */
export async function checkRateLimit(uid: string) {
  const ref = adminDb().doc(`users/${uid}`);
  await adminDb().runTransaction(async (tx) => {
    const usage = (await tx.get(ref)).get('usage') as { windowStart: number; count: number } | undefined;
    const now = Date.now();
    const fresh = !usage || now - usage.windowStart > 3600_000;
    const count = fresh ? 0 : usage.count;
    if (count >= RATE_LIMIT_PER_HOUR) {
      throw new HttpError(429, `You have run ${RATE_LIMIT_PER_HOUR} analyses in the last hour. Please try again later, or open an existing sample package.`);
    }
    tx.set(ref, { usage: { windowStart: fresh ? now : usage.windowStart, count: count + 1 } }, { merge: true });
  });
}

async function storeFiles(pkgId: string, version: number, files: IncomingFiles): Promise<Partial<Record<DocType, DocRef>>> {
  const docs: Partial<Record<DocType, DocRef>> = {};
  await Promise.all((Object.entries(files) as [DocType, IncomingFile][]).map(async ([type, f]) => {
    const ext = type === 'invoiceXml' ? 'xml' : 'pdf';
    const storagePath = `packages/${pkgId}/v${version}/${type}.${ext}`;
    await saveFile(storagePath, f.data, ext === 'xml' ? 'application/xml' : 'application/pdf');
    docs[type] = { storagePath, fileName: f.fileName, sha256: sha256(f.data), size: f.data.length };
  }));
  return docs;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;

/** Create a package, store the files, then run the pipeline to completion. */
export async function createPackage(user: CurrentUser, input: { id?: string; title: string; files: IncomingFiles; sampleId?: string }): Promise<string> {
  validateFiles(input.files, true);
  const db = adminDb();
  const id = input.id && ID_PATTERN.test(input.id) ? input.id : db.collection('packages').doc().id;
  const ref = db.doc(`packages/${id}`);
  if ((await ref.get()).exists) throw new HttpError(409, 'A package with this id already exists');
  await checkRateLimit(user.uid);

  const title = input.title.trim().slice(0, 120) || 'Untitled package';
  // Create the package first so the detail screen can show progress while the files are still uploading
  await ref.set({
    title, sampleId: input.sampleId, ownerUid: user.uid, ownerName: user.name, status: 'analyzing', version: 1, docs: {},
    progress: { step: 'extract', label: 'Uploading the documents…', startedAt: Date.now() },
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  const docs = await storeFiles(id, 1, input.files);
  await ref.update({ docs });
  await audit({ packageId: id, actorUid: user.uid, actorName: user.name, actorRole: user.role ?? 'staff', action: 'package.created', version: 1, detail: title });

  await runPipeline({ pkgId: id, version: 1, docs });
  return id;
}

/** Resubmit: bump the version, swap in the new files, re-run the pipeline (reusing the extraction of unchanged files). */
export async function resubmitPackage(user: CurrentUser, id: string, files: IncomingFiles, comment: string): Promise<void> {
  validateFiles(files, false);
  const db = adminDb();
  const ref = db.doc(`packages/${id}`);
  const pkg = (await ref.get()).data() as PackageDoc | undefined;
  if (!pkg) throw new HttpError(404, 'Package not found');
  if (pkg.ownerUid !== user.uid) throw new HttpError(403, 'Only the person who submitted this package can resubmit it');
  if (pkg.status !== 'needs_fix') throw new HttpError(409, 'This package is not in the "Needs fix" state');
  await checkRateLimit(user.uid);

  const version = pkg.version + 1;
  const newDocs = await storeFiles(id, version, files);
  const docs = { ...pkg.docs, ...newDocs };
  await ref.update({
    status: 'analyzing', version, docs, updatedAt: FieldValue.serverTimestamp(),
    progress: { step: 'extract', label: 'Uploading the documents…', startedAt: Date.now() },
  });
  await ref.collection('approvals').add({
    action: 'resubmit', comment: comment.slice(0, 2000), byUid: user.uid, byName: user.name, version, at: FieldValue.serverTimestamp(),
  });
  await audit({
    packageId: id, actorUid: user.uid, actorName: user.name, actorRole: user.role ?? 'staff', action: 'package.resubmitted',
    version, detail: `Replaced: ${Object.keys(newDocs).join(', ')}`,
  });

  await runPipeline({ pkgId: id, version, docs, previous: { docs: pkg.docs, extracted: pkg.extracted } });
}

/** Re-run the pipeline for a package that failed (status 'error'). */
export async function retryPackage(user: CurrentUser, id: string): Promise<void> {
  const ref = adminDb().doc(`packages/${id}`);
  const pkg = (await ref.get()).data() as PackageDoc | undefined;
  if (!pkg) throw new HttpError(404, 'Package not found');
  if (pkg.ownerUid !== user.uid && user.role !== 'manager') throw new HttpError(403, 'You do not have access to this package');
  if (pkg.status !== 'error') throw new HttpError(409, 'Only a failed package can be re-run');
  await checkRateLimit(user.uid);
  await ref.update({ status: 'analyzing', updatedAt: FieldValue.serverTimestamp() });
  await runPipeline({ pkgId: id, version: pkg.version, docs: pkg.docs });
}
