'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { ProgressSteps } from '@/components/ProgressSteps';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { FindingList } from '@/components/FindingList';
import { PdfViewer, type ViewerTarget } from '@/components/PdfViewer';
import { DecisionPanel } from '@/components/DecisionPanel';
import { ResubmitForm } from '@/components/ResubmitForm';
import { Button, Card, ErrorNote, formatTime, Spinner, StatusBadge } from '@/components/ui';
import { useApprovals, useFindings, usePackage } from '@/lib/hooks';
import { usePendingError } from '@/lib/pending';
import { api } from '@/lib/api-client';
import type { DocType } from '@/types/domain';

const ACTION_TEXT = { approve: 'approved', request_fix: 'requested a fix', reject: 'rejected', resubmit: 'submitted a correction' } as const;

function PackageDetail({ id }: { id: string }) {
  const { role, user } = useAuth();
  const { data: pkg, loading } = usePackage(id);
  const [shownVersion, setShownVersion] = useState<number | null>(null);
  const version = shownVersion ?? pkg?.version;
  const { data: findings } = useFindings(id, version);
  const { data: approvals } = useApprovals(id);
  const pendingError = usePendingError(id);
  const [target, setTarget] = useState<ViewerTarget>({ docType: 'contract' });
  const [retrying, setRetrying] = useState(false);

  if (pendingError && !pkg) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <ErrorNote message={pendingError} />
        <Link href="/staff"><Button variant="secondary">← Back</Button></Link>
      </div>
    );
  }
  if (loading || !pkg) {
    return <p className="flex items-center gap-2 text-zinc-500"><Spinner /> Creating the package and uploading the documents…</p>;
  }

  const available = (['contract', 'acceptance', 'invoice', 'invoiceXml'] as DocType[]).filter((t) => pkg.docs?.[t]);
  const isOwner = user?.uid === pkg.ownerUid;
  const analyzed = pkg.riskScore !== undefined && pkg.status !== 'analyzing';
  const viewingOld = shownVersion !== null && shownVersion !== pkg.version;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={role === 'manager' ? '/manager' : '/staff'} className="text-sm text-indigo-700 hover:underline">← Back</Link>
          <h1 className="mt-1 text-2xl font-semibold">{pkg.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <StatusBadge status={pkg.status} />
            <span>Version {pkg.version}</span>·<span>{pkg.ownerName}</span>·<span>{formatTime(pkg.createdAt)}</span>
          </p>
        </div>
        {pkg.version > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">View version:</span>
            {Array.from({ length: pkg.version }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                onClick={() => setShownVersion(v === pkg.version ? null : v)}
                className={`rounded-md px-2 py-1 ${v === version ? 'bg-indigo-600 text-white' : 'bg-white ring-1 ring-zinc-300'}`}
              >
                v{v}
              </button>
            ))}
          </div>
        )}
      </div>

      <ErrorNote message={pendingError} />
      <ProgressSteps pkg={pkg} />

      {pkg.status === 'error' && (
        <Card className="flex items-center justify-between gap-3 border-red-200 bg-red-50">
          <p className="text-sm text-red-800">{pkg.errorMessage}</p>
          <Button
            variant="secondary"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await api(`/api/packages/${id}/retry`, { method: 'POST' }).catch(() => {});
              setRetrying(false);
            }}
          >
            {retrying && <Spinner />} Try again
          </Button>
        </Card>
      )}

      {role === 'staff' && isOwner && pkg.status === 'needs_fix' && <ResubmitForm pkgId={id} pkg={pkg} />}
      {pkg.lastDecision && pkg.status !== 'needs_fix' && pkg.status !== 'analyzing' && (
        <p className="rounded-lg bg-white px-4 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200">
          Latest decision: <b>{pkg.lastDecision.byName}</b> {ACTION_TEXT[pkg.lastDecision.action]}
          {pkg.lastDecision.comment && <> – “{pkg.lastDecision.comment.slice(0, 200)}”</>}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {analyzed && !viewingOld && (
            <>
              <ScoreBreakdown pkg={pkg} />
              {pkg.summary && (
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">AI summary</p>
                  <p className="mt-1 text-zinc-800">{pkg.summary}</p>
                </Card>
              )}
            </>
          )}
          {role === 'manager' && pkg.status === 'pending_review' && !viewingOld && <DecisionPanel pkgId={id} pkg={pkg} />}
          {(analyzed || viewingOld) && (
            <div>
              <p className="mb-2 font-semibold text-zinc-900">
                Findings {viewingOld ? `(version ${version})` : ''} · {findings.length}
              </p>
              <FindingList findings={findings} onOpen={(docType, page) => setTarget({ docType, page })} />
            </div>
          )}
          {approvals.length > 0 && (
            <Card>
              <p className="mb-2 text-sm font-semibold">Activity history</p>
              <ol className="flex flex-col gap-1.5 text-sm">
                {approvals.map((a) => (
                  <li key={a.id} className="text-zinc-700">
                    <span className="text-zinc-400">{formatTime(a.at)} · v{a.version}</span> <b>{a.byName}</b> {ACTION_TEXT[a.action]}
                    {a.comment && <span className="text-zinc-500"> – {a.comment.split('\n')[0].slice(0, 120)}</span>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          {available.length > 0 && (
            <PdfViewer pkgId={id} version={pkg.version} available={available} target={target} onChange={setTarget} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PackagePage() {
  const { id } = useParams<{ id: string }>();
  return <RequireRole><PackageDetail id={id} /></RequireRole>;
}
