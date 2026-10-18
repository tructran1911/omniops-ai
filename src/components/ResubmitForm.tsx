'use client';

import { useState } from 'react';
import { startRequest } from '@/lib/pending';
import { SAMPLE_FIXES, type SampleId } from '@/lib/samples';
import { DOC_LABELS, type DocType, type PackageDoc } from '@/types/domain';
import { Button, Card, ErrorNote } from './ui';

const TYPES: DocType[] = ['contract', 'acceptance', 'invoice', 'invoiceXml'];

/** Staff resubmit flow for a package that "Needs fix": pick only the corrected files, the rest are carried over. */
export function ResubmitForm({ pkgId, pkg }: { pkgId: string; pkg: PackageDoc }) {
  const [files, setFiles] = useState<Partial<Record<DocType, File>>>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const count = Object.values(files).filter(Boolean).length;

  const fix = pkg.sampleId ? SAMPLE_FIXES[pkg.sampleId as SampleId] : undefined;

  const send = (chosen: Partial<Record<DocType, File>>, note: string) => {
    for (const f of Object.values(chosen)) if (f && f.size > 4 * 1024 * 1024) return setError(`File "${f.name}" is larger than 4 MB`);
    const form = new FormData();
    form.set('comment', note);
    for (const [t, f] of Object.entries(chosen)) if (f) form.set(t, f);
    startRequest(pkgId, `/api/packages/${pkgId}/resubmit`, { method: 'POST', body: form });
    setFiles({});
  };

  /** Demo mode: fetch the bundled corrected files from public/samples and resubmit them — no local files needed. */
  const sendSampleFix = async () => {
    if (!fix) return;
    try {
      const chosen: Partial<Record<DocType, File>> = {};
      for (const f of fix.files) {
        const blob = await fetch(`/samples/${fix.dir}/${f.name}`).then((r) => r.blob());
        chosen[f.type] = new File([blob], f.name, { type: blob.type });
      }
      send(chosen, comment || 'Corrected the unit price and the VAT amount on the invoice (bundled sample fix)');
    } catch {
      setError('Could not load the bundled sample fix');
    }
  };

  return (
    <Card className="flex flex-col gap-3 border-orange-300 bg-orange-50/40">
      <div>
        <p className="font-semibold text-orange-900">The manager requested changes</p>
        <p className="mt-1 whitespace-pre-line rounded-lg bg-white p-3 text-sm text-zinc-800">{pkg.lastDecision?.comment}</p>
        <p className="mt-1 text-xs text-zinc-500">— {pkg.lastDecision?.byName}</p>
      </div>
      <p className="text-sm font-medium text-zinc-800">Submit a correction (pick only the files you changed — the rest are kept)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {TYPES.map((t) => (
          <label key={t} className="flex flex-col gap-1 rounded-lg border border-dashed border-zinc-300 bg-white p-2 text-sm">
            <span className="font-medium">{DOC_LABELS[t]}</span>
            <input
              type="file"
              accept={t === 'invoiceXml' ? '.xml' : 'application/pdf'}
              onChange={(e) => setFiles((m) => ({ ...m, [t]: e.target.files?.[0] }))}
              className="text-xs"
            />
          </label>
        ))}
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Note for the manager (optional)"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
      />
      <ErrorNote message={error} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {fix && (
          <Button variant="secondary" onClick={sendSampleFix}>
            Demo: submit the corrected sample invoice (PDF + XML)
          </Button>
        )}
        <Button disabled={count === 0} onClick={() => send(files, comment)}>Submit correction ({count} file{count === 1 ? '' : 's'})</Button>
      </div>
    </Card>
  );
}
