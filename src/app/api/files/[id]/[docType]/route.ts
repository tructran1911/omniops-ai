import { errorResponse, HttpError, requireUser } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { readFile } from '@/lib/storage';
import type { DocType, PackageDoc } from '@/types/domain';

const TYPES: DocType[] = ['contract', 'acceptance', 'invoice', 'invoiceXml'];

// Serve a package document (current version) to its owner or to a manager.
export async function GET(req: Request, ctx: RouteContext<'/api/files/[id]/[docType]'>) {
  try {
    const user = await requireUser(req);
    const { id, docType } = await ctx.params;
    if (!TYPES.includes(docType as DocType)) throw new HttpError(400, 'Unknown document type');

    const pkg = (await adminDb().doc(`packages/${id}`).get()).data() as PackageDoc | undefined;
    if (!pkg) throw new HttpError(404, 'Package not found');
    if (pkg.ownerUid !== user.uid && user.role !== 'manager') throw new HttpError(403, 'You are not allowed to view this document');
    const ref = pkg.docs[docType as DocType];
    if (!ref) throw new HttpError(404, 'This package has no such document');

    const data = await readFile(ref.storagePath);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': docType === 'invoiceXml' ? 'application/xml; charset=utf-8' : 'application/pdf',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
