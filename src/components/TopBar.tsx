'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { homeOf, signOut, switchRole } from '@/lib/auth-client';

export function TopBar() {
  const { profile, role } = useAuth();
  const router = useRouter();
  const [mock, setMock] = useState(false);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((h) => setMock(Boolean(h.mock))).catch(() => {});
  }, []);

  const other = role === 'manager' ? 'staff' : 'manager';

  return (
    <>
      {mock && (
        <div className="bg-amber-400 px-4 py-1 text-center text-xs font-medium text-amber-950">
          Local dry-run mode: Gemini is mocked with the ground-truth data of the sample documents (GEMINI_MOCK=true)
        </div>
      )}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link href={homeOf(role)} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">O</span>
            <span className="text-lg font-semibold tracking-tight">OmniOps AI</span>
          </Link>
          {role === 'manager' && (
            <nav className="flex gap-1 text-sm">
              <Link className="rounded-md px-3 py-1.5 hover:bg-zinc-100" href="/manager">Approval Kanban</Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-zinc-100" href="/manager/policies">Policies</Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-zinc-100" href="/manager/audit">Audit log</Link>
            </nav>
          )}
          {role === 'staff' && (
            <nav className="flex gap-1 text-sm">
              <Link className="rounded-md px-3 py-1.5 hover:bg-zinc-100" href="/staff">My packages</Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-zinc-100" href="/staff/new">New package</Link>
            </nav>
          )}
          <div className="flex items-center gap-3 text-sm">
            {profile && (
              <span className="text-zinc-600">
                {profile.displayName} ·{' '}
                <span className="font-medium text-zinc-900">{role === 'manager' ? 'Manager' : 'Staff'}</span>
              </span>
            )}
            {profile?.isDemo && (
              <button
                className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 hover:bg-indigo-100"
                onClick={async () => {
                  await switchRole(other);
                  router.push(homeOf(other));
                }}
              >
                Switch to {other === 'manager' ? 'Manager' : 'Staff'}
              </button>
            )}
            <button
              className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
              onClick={async () => {
                await signOut();
                router.push('/');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
