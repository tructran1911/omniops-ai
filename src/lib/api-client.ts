import { auth } from './firebase';

/** Call the app API with the Firebase ID token attached. Throws an Error carrying the server message. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Something went wrong, please try again');
  return body as T;
}

/** Download a file (PDF/XML) with the token attached and return an object URL for the iframe. */
export async function fetchFileUrl(path: string): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? 'Could not load the document');
  }
  return URL.createObjectURL(await res.blob());
}
