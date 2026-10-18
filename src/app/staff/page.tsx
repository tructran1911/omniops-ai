'use client';

import Link from 'next/link';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { PackageCard } from '@/components/PackageCard';
import { SampleButtons } from '@/components/SampleButtons';
import { Button, ErrorNote, Spinner } from '@/components/ui';
import { useMyPackages } from '@/lib/hooks';

function StaffHome() {
  const { user } = useAuth();
  const { data, loading, error } = useMyPackages(user?.uid);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My document packages</h1>
          <p className="text-sm text-zinc-500">Upload the three documents and let OmniOps AI cross-check them before you send the package to a manager.</p>
        </div>
        <Link href="/staff/new"><Button>+ New package</Button></Link>
      </div>
      <SampleButtons />
      <ErrorNote message={error} />
      {loading ? (
        <p className="flex items-center gap-2 text-zinc-500"><Spinner /> Loading…</p>
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">No packages yet. Try one of the sample packages above.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => <PackageCard key={p.id} pkg={p} />)}
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return <RequireRole role="staff"><StaffHome /></RequireRole>;
}
