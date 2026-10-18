// Dry-run extraction + 3-way match + policy + scoring for one package, without Firestore.
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/try-pipeline.ts public/samples/s2-errors [--json]
import { existsSync, readFileSync } from 'node:fs';
import { extractAcceptance, extractContract, extractInvoice } from '@/lib/pipeline/extract';
import { parseInvoiceXml } from '@/lib/pipeline/invoiceXml';
import { threeWayMatch } from '@/lib/pipeline/threeWayMatch';
import { checkPolicies, DEFAULT_RULES, splitRules } from '@/lib/pipeline/policy';
import { scoreFindings } from '@/lib/pipeline/score';
import { modelName } from '@/lib/gemini';

async function main() {
  const dir = process.argv[2] ?? 'public/samples/s2-errors';
  const t0 = Date.now();
  const [contract, acceptance, invoice] = await Promise.all([
    extractContract(readFileSync(`${dir}/contract.pdf`)),
    extractAcceptance(readFileSync(`${dir}/acceptance.pdf`)),
    extractInvoice(readFileSync(`${dir}/invoice.pdf`)),
  ]);
  const tExtract = Date.now() - t0;
  const xml = existsSync(`${dir}/invoice.xml`) ? parseInvoiceXml(readFileSync(`${dir}/invoice.xml`)) : null;

  if (process.argv.includes('--json')) console.log(JSON.stringify({ contract, acceptance, invoice, xml }, null, 2));

  const { tolerancePercent, checks } = splitRules(DEFAULT_RULES);
  const findings = [
    ...threeWayMatch(contract, acceptance, invoice, xml, tolerancePercent),
    ...checkPolicies({ contract, acceptance, invoice }, checks, contract.riskyClauses ?? []),
  ];
  const score = scoreFindings(findings);

  console.log(`\nPackage: ${dir} · model: ${modelName()}`);
  console.table(findings.map((f) => ({ check: f.checkId, severity: f.severity, points: f.points, by: f.deterministic ? 'Code' : 'AI', title: f.title })));
  console.log(`Score: ${score.riskScore}/100 (${score.riskLevel}) · Suggested: ${score.suggestedAction}`);
  console.log(`⏱ Extraction: ${(tExtract / 1000).toFixed(1)} s · Total: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
