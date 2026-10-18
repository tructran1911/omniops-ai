'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Button, ErrorNote, Spinner } from '@/components/ui';
import { homeOf, signInDemo, signInGoogle } from '@/lib/auth-client';
import { firebaseConfigured } from '@/lib/firebase';
import type { Role } from '@/types/domain';

export default function Home() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && role) router.replace(homeOf(role));
  }, [loading, user, role, router]);

  const run = async (key: string, fn: () => Promise<Role | void>, target?: Role) => {
    setBusy(key);
    setError(null);
    try {
      const r = await fn();
      router.push(homeOf(target ?? (r as Role)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
      setBusy(null);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white">O</div>
        <h1 className="text-4xl font-semibold tracking-tight">OmniOps AI</h1>
        <p className="mt-2 text-sm font-medium uppercase tracking-wide text-indigo-700">3-way match · Document approval · Compliance audit trail</p>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-zinc-600">
          Matches the <b>contract, the acceptance record and the VAT e-invoice</b> against your company policy, explains every
          mismatch with page-level citations, and closes the fix–approve loop in real time with an append-only audit trail.
        </p>

        {!firebaseConfigured && (
          <p className="mx-auto mt-8 max-w-xl rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-left text-sm text-red-800">
            <b>Firebase is not configured.</b> Fill in the four config values in <code>src/lib/firebase.ts</code> (see
            README → Setup on Google Cloud, step 6), or run the local mode with <code>npm run dev:local</code>.
          </p>
        )}
        <div className="mx-auto mt-10 flex max-w-md flex-col gap-3">
          <Button variant="secondary" disabled={!!busy} onClick={() => run('google', signInGoogle)} className="py-3">
            {busy === 'google' && <Spinner />} Sign in with Google
          </Button>
          <div className="my-2 flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" /> or try it right now <span className="h-px flex-1 bg-zinc-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button disabled={!!busy} onClick={() => run('staff', () => signInDemo('staff'), 'staff')} className="py-3">
              {busy === 'staff' && <Spinner />} Try as Staff
            </Button>
            <Button disabled={!!busy} onClick={() => run('manager', () => signInDemo('manager'), 'manager')} className="py-3">
              {busy === 'manager' && <Spinner />} Try as Manager
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Demo mode needs no account. All documents are synthetic.
            You can switch roles at any time from the top bar.
          </p>
          <ErrorNote message={error} />
        </div>
      </div>
    </main>
  );
}
