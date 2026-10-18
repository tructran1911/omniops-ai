'use client';

import type { PackageDoc } from '@/types/domain';
import { RiskBadge } from './ui';

const ACTION_LABELS = { APPROVE: 'Suggested: Approve', REQUEST_FIX: 'Suggested: Request fix', REJECT: 'Suggested: Reject' } as const;

export function ScoreBreakdown({ pkg }: { pkg: PackageDoc }) {
  const history = [...(pkg.history ?? [])].sort((a, b) => a.version - b.version);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row">
      <RiskBadge score={pkg.riskScore} level={pkg.riskLevel} size="lg" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-800">Why {pkg.riskScore} points?</p>
          {pkg.suggestedAction && <span className="text-xs font-medium text-zinc-500">{ACTION_LABELS[pkg.suggestedAction]}</span>}
        </div>
        {pkg.scoreBreakdown && pkg.scoreBreakdown.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {pkg.scoreBreakdown.map((b, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-dashed border-zinc-200 pb-1">
                <span className="text-zinc-700"><span className="font-mono text-xs text-zinc-400">{b.checkId}</span> {b.title}</span>
                <span className="font-semibold tabular-nums text-zinc-900">+{b.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Nothing was flagged — no points added.</p>
        )}
        {history.length > 1 && (
          <p className="mt-3 text-sm text-zinc-600">
            History: {history.map((h) => `v${h.version}: ${h.riskScore}`).join(' → ')}
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-400">Score = the sum of all finding points, capped at 100. AI-judged findings add at most 15 points.</p>
      </div>
    </div>
  );
}
