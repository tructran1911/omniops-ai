// Deterministic risk scoring (docs/PROJECT_DOCUMENTATION.md §4). Pure functions.
import type { NewFinding, RiskLevel, ScoreResult, SuggestedAction } from '@/types/domain';

export function riskLevelOf(score: number): RiskLevel {
  if (score < 20) return 'low';
  if (score < 50) return 'medium';
  if (score < 80) return 'high';
  return 'critical';
}

export function scoreFindings(findings: NewFinding[]): ScoreResult {
  const riskScore = Math.min(100, findings.reduce((s, f) => s + f.points, 0));
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHighOrMedium = findings.some((f) => f.severity === 'high' || f.severity === 'medium');

  let suggestedAction: SuggestedAction = 'APPROVE';
  if (hasCritical) suggestedAction = riskScore >= 80 ? 'REJECT' : 'REQUEST_FIX';
  else if (hasHighOrMedium) suggestedAction = 'REQUEST_FIX';

  return {
    riskScore,
    riskLevel: riskLevelOf(riskScore),
    suggestedAction,
    scoreBreakdown: findings
      .filter((f) => f.points > 0)
      .map((f) => ({ checkId: f.checkId, title: f.title, points: f.points })),
  };
}
