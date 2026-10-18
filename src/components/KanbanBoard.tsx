'use client';

import { useEffect, useRef, useState } from 'react';
import type { WithId } from '@/lib/hooks';
import type { PackageDoc, PackageStatus } from '@/types/domain';
import { PackageCard } from './PackageCard';

const COLUMNS: { title: string; statuses: PackageStatus[]; tone: string }[] = [
  { title: 'Pending review', statuses: ['analyzing', 'pending_review', 'error'], tone: 'bg-amber-50 border-amber-200' },
  { title: 'Needs fix', statuses: ['needs_fix'], tone: 'bg-orange-50 border-orange-200' },
  { title: 'Closed', statuses: ['approved', 'rejected'], tone: 'bg-emerald-50 border-emerald-200' },
];

/** Real-time Kanban: a card flashes when it appears or when its status/version changes. */
export function KanbanBoard({ packages }: { packages: WithId<PackageDoc>[] }) {
  const seen = useRef<Map<string, string> | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sig = (p: PackageDoc) => `${p.status}:${p.version}`;
    if (seen.current === null) {
      seen.current = new Map(packages.map((p) => [p.id, sig(p)]));
      return;
    }
    const changed = packages.filter((p) => seen.current!.get(p.id) !== sig(p)).map((p) => p.id);
    seen.current = new Map(packages.map((p) => [p.id, sig(p)]));
    if (changed.length === 0) return;
    setFlash(new Set(changed));
    const t = setTimeout(() => setFlash(new Set()), 2600);
    return () => clearTimeout(t);
  }, [packages]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = packages.filter((p) => col.statuses.includes(p.status));
        return (
          <section key={col.title} className={`flex min-h-[420px] flex-col gap-3 rounded-xl border p-3 ${col.tone}`}>
            <h2 className="flex items-center justify-between px-1 font-semibold text-zinc-800">
              {col.title}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-600">{items.length}</span>
            </h2>
            {items.map((p) => <PackageCard key={p.id} pkg={p} highlight={flash.has(p.id)} showOwner />)}
            {items.length === 0 && <p className="px-1 text-sm text-zinc-400">No packages</p>}
          </section>
        );
      })}
    </div>
  );
}
