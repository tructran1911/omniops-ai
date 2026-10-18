'use client';

import Link from 'next/link';
import { RequireRole } from '@/components/RequireRole';
import { Card, ErrorNote, formatTime, Spinner } from '@/components/ui';
import { useAuditLog } from '@/lib/hooks';
import type { AuditAction } from '@/types/domain';

const ACTION_LABELS: Record<AuditAction, string> = {
  'package.created': 'Package created',
  'analysis.completed': 'AI analysis completed',
  'analysis.failed': 'AI analysis failed',
  'decision.approve': 'Approved',
  'decision.request_fix': 'Fix requested',
  'decision.reject': 'Rejected',
  'package.resubmitted': 'Correction submitted',
  'policy.updated': 'Policy updated',
};

const ROLE_LABELS = { staff: 'Staff', manager: 'Manager', system: 'System' } as const;

function AuditLog() {
  const { data, loading, error } = useAuditLog(true);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-zinc-500">
          Append-only: nothing can be edited or deleted (Firestore Rules block every write from the browser). Each AI analysis stores
          the model, the prompt hash and the result hash for traceability.
        </p>
      </div>
      <ErrorNote message={error} />
      {loading ? (
        <p className="flex items-center gap-2 text-zinc-500"><Spinner /> Loading…</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-2">Time</th><th className="px-4 py-2">Actor</th><th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Package</th><th className="px-4 py-2">Detail</th><th className="px-4 py-2">Model · hash</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-zinc-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">{formatTime(e.at)}</td>
                  <td className="px-4 py-2">{e.actorName}<div className="text-xs text-zinc-400">{ROLE_LABELS[e.actorRole]}</div></td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{ACTION_LABELS[e.action] ?? e.action}</td>
                  <td className="px-4 py-2">
                    {e.packageId ? <Link className="text-indigo-700 hover:underline" href={`/packages/${e.packageId}`}>v{e.version ?? '–'}</Link> : '—'}
                  </td>
                  <td className="max-w-sm px-4 py-2 text-zinc-600">{e.detail}</td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                    {e.model && <div>{e.model}</div>}
                    {e.resultHash && <div title={`prompt ${e.promptHash}\nresult ${e.resultHash}`}>#{e.resultHash.slice(0, 8)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && <p className="p-6 text-center text-zinc-500">No events yet.</p>}
        </Card>
      )}
    </div>
  );
}

export default function AuditPage() {
  return <RequireRole role="manager"><AuditLog /></RequireRole>;
}
