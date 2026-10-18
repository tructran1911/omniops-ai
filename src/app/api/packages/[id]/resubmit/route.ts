import { errorResponse, requireUser } from '@/lib/auth-server';
import { filesFromForm, resubmitPackage } from '@/lib/packages';

// Staff resubmit a package that "Needs fix". The response waits for the pipeline to finish re-running.
export async function POST(req: Request, ctx: RouteContext<'/api/packages/[id]/resubmit'>) {
  try {
    const user = await requireUser(req, 'staff');
    const { id } = await ctx.params;
    const form = await req.formData();
    await resubmitPackage(user, id, await filesFromForm(form), String(form.get('comment') ?? ''));
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
