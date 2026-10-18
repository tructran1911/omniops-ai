// Unit tests for C1–C7, P1–P3 and the scoring, with NO Gemini calls.
// Run: npx tsx --conditions=react-server scripts/test-match.ts
import { readFileSync } from 'node:fs';
import { threeWayMatch } from '@/lib/pipeline/threeWayMatch';
import { checkPolicies, DEFAULT_RULES, splitRules } from '@/lib/pipeline/policy';
import { scoreFindings } from '@/lib/pipeline/score';
import { parseInvoiceXml } from '@/lib/pipeline/invoiceXml';
import type { AcceptanceData, ContractData, InvoiceData, InvoiceXmlData } from '@/types/domain';

type Manifest = Record<string, { docType: string; package: string; data: unknown }>;
const manifest: Manifest = JSON.parse(readFileSync('public/samples/manifest.json', 'utf-8'));
const truth = (pkg: string, docType: string) =>
  structuredClone(Object.values(manifest).find((m) => m.package === pkg && m.docType === docType)!.data);

function run(c: ContractData, a: AcceptanceData, i: InvoiceData, x: InvoiceXmlData | null) {
  const { tolerancePercent, checks } = splitRules(DEFAULT_RULES);
  const findings = [
    ...threeWayMatch(c, a, i, x, tolerancePercent),
    ...checkPolicies({ contract: c, acceptance: a, invoice: i }, checks, c.riskyClauses ?? []),
  ];
  return { findings, ids: [...new Set(findings.map((f) => f.checkId))].sort(), score: scoreFindings(findings) };
}

const clean = () => ({
  c: truth('s1-clean', 'contract') as ContractData,
  a: truth('s1-clean', 'acceptance') as AcceptanceData,
  i: truth('s1-clean', 'invoice') as InvoiceData,
  x: parseInvoiceXml(readFileSync('public/samples/s1-clean/invoice.xml')),
});

const cases: { name: string; expect: string[]; mutate?: (d: ReturnType<typeof clean>) => void; score?: number }[] = [
  { name: 'Clean package', expect: [], score: 0 },
  { name: 'C1 wrong seller tax ID', expect: ['C1', 'C7'], mutate: (d) => { d.i.seller.taxId = '0312345679'; } },
  { name: 'C1 wrong tax ID (XML agrees with PDF)', expect: ['C1'], mutate: (d) => { d.i.seller.taxId = '0312345679'; d.x.sellerTaxId = '0312345679'; } },
  { name: 'C2 total mismatch', expect: ['C2', 'C3', 'C7'], mutate: (d) => { d.i.total += 50_000_000; } },
  { name: 'C2 within tolerance', expect: ['C3', 'C7'], mutate: (d) => { d.i.total += 2_000_000; } },
  { name: 'C3 wrong VAT', expect: ['C2', 'C3'], mutate: (d) => { d.i.vatAmount += 10_000_000; d.i.total += 10_000_000; d.x.total = d.i.total; } },
  { name: 'C4 quantity above accepted', expect: ['C4'], mutate: (d) => { d.i.items[0].quantity = 6; } },
  { name: 'C4 unknown item code', expect: ['C4'], mutate: (d) => { d.i.items.push({ code: 'XX-99', quantity: 1, unitPrice: 0, amount: 0 }); } },
  { name: 'C4 differently written code (SV01) still matches', expect: [], mutate: (d) => { d.i.items[0].code = 'sv01'; } },
  { name: 'C5 unit price mismatch', expect: ['C5'], mutate: (d) => { d.i.items[0].unitPrice = 203_000_000; } },
  { name: 'C6 invoice before acceptance', expect: ['C6'], mutate: (d) => { d.i.issueDate = '2026-10-01'; } },
  { name: 'C7 XML total mismatch', expect: ['C7'], mutate: (d) => { d.x.total = (d.x.total ?? 0) + 20_000_000; } },
  { name: 'P1 penalty too high', expect: ['P1'], mutate: (d) => { d.c.latePenaltyPercentPerDay = 0.3; } },
  { name: 'P2 advance payment too high', expect: ['P2'], mutate: (d) => { d.c.advancePaymentPercent = 50; } },
  { name: 'P3 payment term too long', expect: ['P3'], mutate: (d) => { d.c.paymentTermDays = 90; } },
  { name: 'AI findings capped at 15 pts', expect: ['AI'], score: 15, mutate: (d) => {
    d.c.riskyClauses = [1, 2, 3, 4].map((n) => ({ page: 3, quote: `Clause ${n}`, reason: 'Unfavourable' }));
  } },
];

let failed = 0;
for (const t of cases) {
  const d = clean();
  t.mutate?.(d);
  const r = run(d.c, d.a, d.i, d.x);
  const ok = JSON.stringify(r.ids) === JSON.stringify([...t.expect].sort()) && (t.score === undefined || r.score.riskScore === t.score);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name.padEnd(36)} → [${r.ids.join(', ')}] ${r.score.riskScore} pts`);
}

// Check against the 4 real sample packages (ground truth from the manifest)
const samples: Record<string, { ids: string[]; score: number }> = {
  's1-clean': { ids: [], score: 0 },
  's2-errors': { ids: ['C2', 'C3', 'C5'], score: 60 },
  's2-fixed': { ids: [], score: 0 },
  's3-risky': { ids: ['AI', 'C1', 'C6', 'P1'], score: 70 },
};
for (const [pkg, want] of Object.entries(samples)) {
  const r = run(
    truth(pkg, 'contract') as ContractData, truth(pkg, 'acceptance') as AcceptanceData, truth(pkg, 'invoice') as InvoiceData,
    parseInvoiceXml(readFileSync(`public/samples/${pkg}/invoice.xml`)),
  );
  const ok = JSON.stringify(r.ids) === JSON.stringify(want.ids) && r.score.riskScore === want.score;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  Sample ${pkg.padEnd(28)} → [${r.ids.join(', ')}] ${r.score.riskScore} pts (${r.score.suggestedAction})`);
}

console.log(failed ? `\n❌ ${failed} case(s) FAILED` : '\n✅ All PASS');
process.exit(failed ? 1 : 0);
