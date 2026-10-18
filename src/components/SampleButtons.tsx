'use client';

import { useRouter } from 'next/navigation';
import { collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startRequest } from '@/lib/pending';
import { SAMPLES, type SampleId } from '@/lib/samples';
import { Card } from './ui';

export function SampleButtons() {
  const router = useRouter();
  const start = (sampleId: SampleId) => {
    const id = doc(collection(db, 'packages')).id;
    startRequest(id, '/api/packages/from-sample', { method: 'POST', body: JSON.stringify({ id, sampleId }) });
    router.push(`/packages/${id}`);
  };
  return (
    <Card>
      <p className="font-medium text-zinc-900">Try a sample package</p>
      <p className="mt-1 text-sm text-zinc-500">Each package contains a contract, an acceptance record, a VAT invoice PDF and the matching e-invoice XML.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(Object.entries(SAMPLES) as [SampleId, (typeof SAMPLES)[SampleId]][]).map(([id, s]) => (
          <button
            key={id}
            onClick={() => start(id)}
            className="rounded-lg border border-zinc-200 p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
          >
            <p className="text-sm font-semibold text-zinc-900">{s.label}</p>
            <p className="mt-1 text-xs text-zinc-500">{s.hint}</p>
          </button>
        ))}
      </div>
    </Card>
  );
}
