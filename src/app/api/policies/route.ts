import { z } from 'zod';
import { errorResponse, HttpError, requireUser } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { audit } from '@/lib/audit';
import { loadPolicyRules } from '@/lib/pipeline/run';

const Rule = z.object({
  id: z.string().regex(/^[A-Z0-9_]{1,10}$/),
  name: z.string().min(1).max(120),
  field: z.string().min(1).max(80),
  operator: z.enum(['lte', 'gte']),
  value: z.number().finite().min(0),
  unit: z.string().max(20),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  points: z.number().int().min(0).max(100),
  enabled: z.boolean(),
});
const Body = z.object({ rules: z.array(Rule).min(1).max(30) });

// A manager saves the policy thresholds. They apply to every later analysis.
export async function PUT(req: Request) {
  try {
    const user = await requireUser(req, 'manager');
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Invalid policy payload');

    const before = new Map((await loadPolicyRules()).map((r) => [r.id, r]));
    const changes: string[] = [];
    const db = adminDb();
    const batch = db.batch();
    for (const { id, ...rule } of parsed.data.rules) {
      const old = before.get(id);
      if (old && (old.value !== rule.value || old.enabled !== rule.enabled)) {
        changes.push(`${id}: ${old.value}${old.enabled ? '' : ' (off)'} → ${rule.value}${rule.enabled ? '' : ' (off)'}`);
      }
      batch.set(db.doc(`policy_rules/${id}`), rule);
    }
    await batch.commit();

    await audit({
      actorUid: user.uid, actorName: user.name, actorRole: 'manager', action: 'policy.updated',
      detail: changes.join('; ') || 'No value changed',
    });
    return Response.json({ ok: true, changes });
  } catch (err) {
    return errorResponse(err);
  }
}
