// Policy checks (P*) and the AI-flagged risky clauses (docs/PROJECT_DOCUMENTATION.md §4). Pure functions.
import type { Evidence, Extracted, NewFinding, PolicyRule, RiskyClause } from '@/types/domain';
import { ev } from './threeWayMatch';

export const DEFAULT_TOLERANCE_PERCENT = 0.5;
export const AI_POINTS_EACH = 5;
export const AI_POINTS_MAX = 15;

export const DEFAULT_RULES: PolicyRule[] = [
  { id: 'P1', name: 'Maximum late-payment penalty', field: 'contract.latePenaltyPercentPerDay', operator: 'lte', value: 0.1, unit: '%/day', severity: 'high', points: 20, enabled: true },
  { id: 'P2', name: 'Maximum advance payment', field: 'contract.advancePaymentPercent', operator: 'lte', value: 30, unit: '%', severity: 'medium', points: 10, enabled: true },
  { id: 'P3', name: 'Maximum payment term', field: 'contract.paymentTermDays', operator: 'lte', value: 45, unit: 'days', severity: 'low', points: 5, enabled: true },
  { id: 'TOL', name: 'Invoice-vs-contract total tolerance', field: 'tolerance', operator: 'lte', value: DEFAULT_TOLERANCE_PERCENT, unit: '%', severity: 'low', points: 0, enabled: true },
];

export const FIELD_LABELS: Record<string, string> = {
  'contract.latePenaltyPercentPerDay': 'Contract – late-payment penalty',
  'contract.advancePaymentPercent': 'Contract – advance payment',
  'contract.paymentTermDays': 'Contract – payment term',
  tolerance: 'Check C2 – invoice total',
};

/** Split the tolerance rule (TOL) from the threshold rules. */
export function splitRules(rules: PolicyRule[]) {
  const tol = rules.find((r) => r.id === 'TOL');
  return {
    tolerancePercent: tol?.enabled === false ? 0 : tol?.value ?? DEFAULT_TOLERANCE_PERCENT,
    checks: rules.filter((r) => r.id !== 'TOL'),
  };
}

function getPath(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });

export function checkPolicies(facts: Pick<Extracted, 'contract' | 'acceptance' | 'invoice'>, rules: PolicyRule[], riskyClauses: RiskyClause[] = []): NewFinding[] {
  const out: NewFinding[] = [];

  for (const r of rules) {
    if (!r.enabled || r.id === 'TOL') continue;
    const raw = getPath(facts, r.field);
    if (typeof raw !== 'number' || Number.isNaN(raw)) continue;
    const ok = r.operator === 'lte' ? raw <= r.value : raw >= r.value;
    if (ok) continue;
    const [docType, ...rest] = r.field.split('.');
    const doc = facts[docType as keyof typeof facts] as { evidence?: Evidence[] } | undefined;
    out.push({
      checkId: r.id, category: 'policy', severity: r.severity, points: r.points, deterministic: true,
      title: `Policy violation: ${r.name}`,
      explanation: `The document states ${fmt(raw)}${r.unit}, while company policy requires ${r.operator === 'lte' ? '≤' : '≥'} ${fmt(r.value)}${r.unit}.`,
      evidence: doc ? ev(docType as 'contract', doc, rest.join('.')) : [],
    });
  }

  let aiPoints = 0;
  for (const cl of riskyClauses) {
    const points = Math.min(AI_POINTS_EACH, AI_POINTS_MAX - aiPoints);
    aiPoints += points;
    out.push({
      checkId: 'AI', category: 'clause', severity: 'medium', points, deterministic: false,
      title: 'Clause unfavourable to the buyer (AI judgement)',
      explanation: cl.reason,
      evidence: [{ docType: 'contract', page: cl.page, quote: cl.quote }],
    });
  }

  return out;
}
