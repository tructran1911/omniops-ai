import 'server-only';
import { adminAuth, adminDb } from './firebase-admin';
import type { Role } from '@/types/domain';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface CurrentUser { uid: string; role?: Role; name: string; isDemo: boolean }

/** Verify the Firebase ID token (Authorization: Bearer header) and check the role. */
export async function requireUser(req: Request, needRole?: Role): Promise<CurrentUser> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'You are not signed in');

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    throw new HttpError(401, 'Your session has expired, please sign in again');
  }

  const snap = await adminDb().doc(`users/${uid}`).get();
  const role = snap.get('role') as Role | undefined;
  if (needRole && role !== needRole) throw new HttpError(403, 'You are not allowed to perform this action');
  return { uid, role, name: (snap.get('displayName') as string) || 'User', isDemo: Boolean(snap.get('isDemo')) };
}

/** Turn an error into a JSON { error } body. Unexpected errors are logged and reported as a generic message. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: 'Something went wrong on the server, please try again' }, { status: 500 });
}
