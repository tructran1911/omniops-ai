'use client';

import Link from 'next/link';
import type { WithId } from '@/lib/hooks';
import type { PackageDoc } from '@/types/domain';
import { formatTime, RiskBadge, StatusBadge } from './ui';

export function PackageCard({ pkg, highlight = false, showOwner = false }: { pkg: WithId<PackageDoc>; highlight?: boolean; showOwner?: boolean }) {
  return (
    <Link
      href={`/packages/${pkg.id}`}
      className={`block rounded-xl border bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow ${
        highlight ? 'animate-flash border-indigo-400' : 'border-zinc-200'
      } ${pkg.status === 'rejected' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug text-zinc-900">{pkg.title}</p>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">v{pkg.version}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={pkg.status} />
        {pkg.status !== 'analyzing' && <RiskBadge score={pkg.riskScore} level={pkg.riskLevel} />}
        {pkg.findingCount !== undefined && pkg.status !== 'analyzing' && (
          <span className="text-xs text-zinc-500">{pkg.findingCount} finding{pkg.findingCount === 1 ? '' : 's'}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {showOwner && <>{pkg.ownerName} · </>}
        {formatTime(pkg.updatedAt)}
      </p>
    </Link>
  );
}
