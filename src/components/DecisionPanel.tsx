'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import type { DecisionAction, PackageDoc } from '@/types/domain';
import { Button, Card, ErrorNote, Spinner } from './ui';

const TITLES: Record<DecisionAction, string> = {
  approve: 'Approve for payment',
  request_fix: 'Request changes',
  reject: 'Reject this package',
};

/** Manager actions: Approve / Request fix / Reject. The "Request fix" text is drafted by AI; the manager edits it before sending. */
export function DecisionPanel({ pkgId, pkg }: { pkgId: string; pkg: PackageDoc }) {
  const [open, setOpen] = useState<DecisionAction | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (action: DecisionAction) => {
    setOpen(action);
    setError(null);
    setComment(action === 'request_fix' ? pkg.fixRequestDraft ?? '' : '');
  };

  const send = async () => {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/packages/${pkgId}/decision`, { method: 'POST', body: JSON.stringify({ action: open, comment }) });
      setOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the decision');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold text-zinc-900">Manager decision</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="success" onClick={() => choose('approve')}>✓ Approve</Button>
        <Button variant="secondary" onClick={() => choose('request_fix')}>✎ Request fix</Button>
        <Button variant="danger" onClick={() => choose('reject')}>✕ Reject</Button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-medium">{TITLES[open]}</p>
          {open === 'request_fix' && pkg.fixRequestDraft && (
            <p className="text-xs text-violet-700">Drafted by AI from the findings below — review and edit it before sending.</p>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={open === 'request_fix' ? 8 : 3}
            placeholder={open === 'approve' ? 'Note (optional)' : open === 'reject' ? 'Reason for rejection (required)' : 'What needs to be fixed (required)'}
            className="rounded-lg border border-zinc-300 bg-white p-2 text-sm outline-none focus:border-indigo-500"
          />
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(null)} disabled={busy}>Cancel</Button>
            <Button onClick={send} disabled={busy}>{busy && <Spinner />} Send</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
