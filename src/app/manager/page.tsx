'use client';

import { RequireRole } from '@/components/RequireRole';
import { KanbanBoard } from '@/components/KanbanBoard';
import { ErrorNote, Spinner } from '@/components/ui';
import { useAllPackages } from '@/lib/hooks';

function ManagerHome() {
  const { data, loading, error } = useAllPackages(true);
  const pending = data.filter((p) => p.status === 'pending_review').length;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Document approval Kanban</h1>
        <p className="text-sm text-zinc-500">
          Updated in real time through Firestore · {pending} package{pending === 1 ? '' : 's'} waiting for your decision. Click a card to see the findings and decide.
        </p>
      </div>
      <ErrorNote message={error} />
      {loading ? <p className="flex items-center gap-2 text-zinc-500"><Spinner /> Loading…</p> : <KanbanBoard packages={data} />}
    </div>
  );
}

export default function ManagerPage() {
  return <RequireRole role="manager"><ManagerHome /></RequireRole>;
}
