import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { errorResponse, HttpError, requireUser } from '@/lib/auth-server';
import { createPackage, type IncomingFiles } from '@/lib/packages';
import { SAMPLE_IDS, SAMPLES } from '@/lib/samples';

const Body = z.object({ id: z.string().optional(), sampleId: z.enum(SAMPLE_IDS) });

// Create a package from the bundled sample documents in public/samples (demo mode).
export async function POST(req: Request) {
  try {
    const user = await requireUser(req, 'staff');
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Unknown sample package');
    const { id, sampleId } = parsed.data;

    const dir = path.join(process.cwd(), 'public', 'samples', sampleId);
    const load = async (name: string) => ({ fileName: name, data: await readFile(path.join(dir, name)) });
    const files: IncomingFiles = {
      contract: await load('contract.pdf'),
      acceptance: await load('acceptance.pdf'),
      invoice: await load('invoice.pdf'),
      invoiceXml: await load('invoice.xml'),
    };
    const newId = await createPackage(user, { id, sampleId, title: `Q4 server purchase – ${SAMPLES[sampleId].label}`, files });
    return Response.json({ id: newId });
  } catch (err) {
    return errorResponse(err);
  }
}
