import 'server-only';
import { generateJson, isMock, withRetry } from '@/lib/gemini';
import { SUMMARY_PROMPT } from './prompts';
import { summarySchema } from './schemas';
import type { NewFinding, ScoreResult } from '@/types/domain';

export interface Summary { summary: string; fixRequestDraft: string }

/** Gemini turns the finding list into a summary + a fix-request draft (it never adds new findings). */
export async function summarize(findings: NewFinding[], score: ScoreResult): Promise<Summary> {
  if (isMock() || findings.length === 0) return templateSummary(findings, score);
  const compact = findings.map((f) => ({ checkId: f.checkId, severity: f.severity, title: f.title, explanation: f.explanation }));
  try {
    return await withRetry(() => generateJson<Summary>(SUMMARY_PROMPT(JSON.stringify(compact, null, 1), score.riskScore), summarySchema));
  } catch (err) {
    // The summary is only an interpretation layer: on failure fall back to a template instead of failing the pipeline.
    console.error('[summarize] Gemini failed, falling back to the template summary:', err);
    return templateSummary(findings, score);
  }
}

export function templateSummary(findings: NewFinding[], score: ScoreResult): Summary {
  if (findings.length === 0) {
    return { summary: 'All three documents agree and no policy rule is violated. The package can be approved for payment.', fixRequestDraft: '' };
  }
  const level = { low: 'low', medium: 'medium', high: 'high', critical: 'critical' }[score.riskLevel];
  return {
    summary: `Found ${findings.length} issue${findings.length === 1 ? '' : 's'} at ${level} risk (${score.riskScore}/100). ` +
      `Most important: ${findings[0].title.toLowerCase()}.`,
    fixRequestDraft: 'Dear colleague,\n\nThe following points need to be corrected before this package can be approved for payment:\n' +
      findings.map((f) => `- ${f.title}: ${f.explanation}`).join('\n') +
      '\n\nPlease send the corrected documents back for a re-check. Thank you.',
  };
}
