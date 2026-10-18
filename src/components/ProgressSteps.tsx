'use client';

import { useElapsed } from '@/lib/hooks';
import type { PackageDoc, ProgressStep } from '@/types/domain';
import { Spinner } from './ui';

const STEPS: { key: ProgressStep; label: string; detail: string }[] = [
  { key: 'extract', label: 'Extract', detail: 'Gemini reads the 3 PDFs in parallel' },
  { key: 'match', label: '3-way match', detail: '7 deterministic checks in code' },
  { key: 'policy', label: 'Policy', detail: 'Company thresholds + risky clauses' },
  { key: 'score', label: 'Score', detail: 'Risk score + AI summary' },
];
const ORDER: ProgressStep[] = ['extract', 'match', 'policy', 'score', 'done'];

export function ProgressSteps({ pkg }: { pkg: PackageDoc }) {
  const progress = pkg.progress;
  const done = pkg.status !== 'analyzing';
  const elapsed = useElapsed(progress?.startedAt, done ? progress?.finishedAt ?? progress?.startedAt : undefined);
  const current = progress ? ORDER.indexOf(progress.step) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700">
          {pkg.status === 'analyzing' ? progress?.label ?? 'Getting ready…' : pkg.status === 'error' ? 'Analysis failed' : 'Analysis complete'}
        </p>
        <p className="font-mono text-sm tabular-nums text-zinc-600" title="Wall-clock time measured on the server">
          ⏱ {elapsed.toFixed(1)} s{pkg.usedCache && done ? ' · reused cached extraction' : ''}
        </p>
      </div>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, idx) => {
          const state = pkg.status === 'error' && idx === current ? 'error' : idx < current || (done && pkg.status !== 'error') ? 'done' : idx === current ? 'active' : 'todo';
          const styles = {
            done: 'border-emerald-300 bg-emerald-50 text-emerald-800',
            active: 'border-indigo-400 bg-indigo-50 text-indigo-800',
            todo: 'border-zinc-200 bg-zinc-50 text-zinc-400',
            error: 'border-red-300 bg-red-50 text-red-800',
          }[state];
          return (
            <li key={s.key} className={`rounded-lg border px-3 py-2 ${styles}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {state === 'active' ? <Spinner className="h-3.5 w-3.5" /> : state === 'done' ? '✓' : state === 'error' ? '✕' : idx + 1}
                {s.label}
              </div>
              <p className="mt-0.5 text-xs opacity-80">{s.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
