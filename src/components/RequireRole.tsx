'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { TopBar } from './TopBar';
import { Spinner } from './ui';
import { homeOf } from '@/lib/auth-client';
import type { Role } from '@/types/domain';

/** Signed-in page shell: no session → back to "/"; wrong role → redirect to that role's home. */
export function RequireRole({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, role: current, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !current) router.replace('/');
    else if (role && current !== role) router.replace(homeOf(current));
  }, [loading, user, current, role, router]);

  if (loading || !user || !current || (role && current !== role)) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-zinc-500">
        <Spinner /> Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <TopBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
