import { errorResponse, requireUser } from '@/lib/auth-server';
import { retryPackage } from '@/lib/packages';

// Re-run the analysis for a failed package (for example after a temporary Gemini outage).
export async function POST(req: Request, ctx: RouteContext<'/api/packages/[id]/retry'>) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    await retryPackage(user, id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
