import { errorResponse, requireUser } from '@/lib/auth-server';
import { createPackage, filesFromForm } from '@/lib/packages';

// Create a package from the 3 PDFs (+ XML). The response is only sent after the pipeline finishes (Cloud Run throttles CPU once a response is sent).
export async function POST(req: Request) {
  try {
    const user = await requireUser(req, 'staff');
    const form = await req.formData();
    const id = await createPackage(user, {
      id: String(form.get('id') ?? ''),
      title: String(form.get('title') ?? ''),
      files: await filesFromForm(form),
    });
    return Response.json({ id });
  } catch (err) {
    return errorResponse(err);
  }
}
