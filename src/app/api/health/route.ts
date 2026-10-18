import { isMock, modelName } from '@/lib/gemini';

// Liveness check, also used to warm up Cloud Run before a demo.
export async function GET() {
  return Response.json({ ok: true, at: new Date().toISOString(), model: modelName(), mock: isMock() });
}
