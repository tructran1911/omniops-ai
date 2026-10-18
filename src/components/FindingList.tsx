'use client';

import { DOC_LABELS, type DocType, type Finding, type Severity } from '@/types/domain';
import { SeverityTag } from './ui';

const ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

export function FindingList({ findings, onOpen }: { findings: Finding[]; onOpen: (docType: DocType, page?: number) => void }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        ✓ No mismatch and no policy violation. All three documents agree.
      </div>
    );
  }
  const sorted = [...findings].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((f) => (
        <li key={f.id} className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityTag severity={f.severity} />
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${f.deterministic ? 'bg-zinc-800 text-white' : 'bg-violet-100 text-violet-800'}`}
              title={f.deterministic ? 'Deterministic code check: re-running always gives the same result' : 'Judged by Gemini: needs a human review'}
            >
              {f.deterministic ? 'Code' : 'AI'} · {f.checkId}
            </span>
            <span className="ml-auto text-xs font-semibold text-zinc-500">+{f.points} pts</span>
          </div>
          <p className="mt-2 font-medium text-zinc-900">{f.title}</p>
          <p className="mt-1 text-sm text-zinc-600">{f.explanation}</p>
          {f.evidence.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {f.evidence.map((e, i) => (
                <button
                  key={i}
                  onClick={() => onOpen(e.docType, e.page)}
                  className="group flex items-start gap-2 rounded-md bg-zinc-50 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                  title="Open the document at this page"
                >
                  <span className="shrink-0 font-medium text-indigo-700 group-hover:underline">
                    {DOC_LABELS[e.docType]}{e.page ? ` · page ${e.page}` : ''}
                  </span>
                  <span className="italic text-zinc-700">“{e.quote}”</span>
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
