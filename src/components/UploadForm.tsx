'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startRequest } from '@/lib/pending';
import { DOC_LABELS, type DocType } from '@/types/domain';
import { Button, Card, ErrorNote } from './ui';

const MAX_BYTES = 4 * 1024 * 1024;
const FIELDS: { type: DocType; required: boolean; accept: string; hint: string }[] = [
  { type: 'contract', required: true, accept: 'application/pdf', hint: 'PDF, up to 4 MB' },
  { type: 'acceptance', required: true, accept: 'application/pdf', hint: 'PDF, up to 4 MB' },
  { type: 'invoice', required: true, accept: 'application/pdf', hint: 'PDF, up to 4 MB' },
  { type: 'invoiceXml', required: false, accept: '.xml,application/xml,text/xml', hint: 'Optional – the e-invoice XML file' },
];

export function UploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<Partial<Record<DocType, File>>>({});
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(files.contract && files.acceptance && files.invoice);

  const submit = () => {
    for (const f of Object.values(files)) {
      if (f && f.size > MAX_BYTES) return setError(`File "${f.name}" is larger than 4 MB`);
    }
    for (const t of ['contract', 'acceptance', 'invoice'] as const) {
      if (files[t] && !files[t]!.name.toLowerCase().endsWith('.pdf')) return setError(`${DOC_LABELS[t]}: only PDF files are accepted`);
    }
    const id = doc(collection(db, 'packages')).id;
    const form = new FormData();
    form.set('id', id);
    form.set('title', title);
    for (const [t, f] of Object.entries(files)) if (f) form.set(t, f);
    startRequest(id, '/api/packages', { method: 'POST', body: form });
    router.push(`/packages/${id}`);
  };

  return (
    <Card className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-800">Package name</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q4 server purchase – An Phat Co."
          className="rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-indigo-500"
          maxLength={120}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.type} className="flex flex-col gap-1.5 rounded-lg border border-dashed border-zinc-300 p-3 hover:border-indigo-400">
            <span className="text-sm font-medium text-zinc-800">
              {DOC_LABELS[f.type]} {f.required && <span className="text-red-600">*</span>}
            </span>
            <input
              type="file"
              accept={f.accept}
              onChange={(e) => setFiles((m) => ({ ...m, [f.type]: e.target.files?.[0] }))}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700"
            />
            <span className="text-xs text-zinc-500">{files[f.type]?.name ?? f.hint}</span>
          </label>
        ))}
      </div>
      <ErrorNote message={error} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Use synthetic documents for the demo — please do not upload real company documents.</p>
        <Button disabled={!ready} onClick={submit}>Analyze</Button>
      </div>
    </Card>
  );
}
