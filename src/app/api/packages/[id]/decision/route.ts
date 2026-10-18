import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { errorResponse, HttpError, requireUser } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { audit } from '@/lib/audit';
import type { PackageDoc, PackageStatus } from '@/types/domain';

const Body = z.object({
  action: z.enum(['approve', 'request_fix', 'reject']),
  comment: z.string().max(4000).default(''),
});

const NEXT_STATUS: Record<z.infer<typeof Body>['action'], PackageStatus> = {
  approve: 'approved',
  request_fix: 'needs_fix',
  reject: 'rejected',
};

// A manager decides on a package that is pending review.
export async function POST(req: Request, ctx: RouteContext<'/api/packages/[id]/decision'>) {
  try {
    const user = await requireUser(req, 'manager');
    const { id } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Invalid decision payload');
    const { action, comment } = parsed.data;
    if ((action === 'reject' || action === 'request_fix') && !comment.trim()) {
      throw new HttpError(400, action === 'reject' ? 'Please give a reason for the rejection' : 'Please describe what needs to be fixed');
    }

    const db = adminDb();
    const ref = db.doc(`packages/${id}`);
    const version = await db.runTransaction(async (tx) => {
      const pkg = (await tx.get(ref)).data() as PackageDoc | undefined;
      if (!pkg) throw new HttpError(404, 'Package not found');
      if (pkg.status !== 'pending_review') throw new HttpError(409, 'This package is no longer pending review');
      tx.update(ref, {
        status: NEXT_STATUS[action],
        lastDecision: { action, comment, byName: user.name, at: Date.now() },
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(ref.collection('approvals').doc(), {
        action, comment, byUid: user.uid, byName: user.name, version: pkg.version, at: FieldValue.serverTimestamp(),
      });
      return pkg.version;
    });

    await audit({
      packageId: id, actorUid: user.uid, actorName: user.name, actorRole: 'manager', action: `decision.${action}`,
      version, detail: comment.slice(0, 300),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
