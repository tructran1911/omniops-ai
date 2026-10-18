// Benchmark the pipeline against labelled synthetic packages (benchmark/labels.json). No cache, no Firestore writes.
// Prepare: npm run gen:bench
// Run:     npm run benchmark -- --runs 3            (real Gemini, needs GEMINI_API_KEY in .env.local)
//          npm run benchmark -- --limit 2 --runs 1  (quick smoke run)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { extractAcceptance, extractContract, extractInvoice } from '@/lib/pipeline/extract';
import { parseInvoiceXml } from '@/lib/pipeline/invoiceXml';
import { threeWayMatch } from '@/lib/pipeline/threeWayMatch';
import { checkPolicies, DEFAULT_RULES, splitRules } from '@/lib/pipeline/policy';
import { scoreFindings } from '@/lib/pipeline/score';
import { modelName } from '@/lib/gemini';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
};
const RUNS = arg('runs', 3);
const LIMIT = arg('limit', Infinity);
const DELAY = arg('delay', 5000);
const ROOT = 'benchmark';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (a: number, b: number) => (b === 0 ? '–' : `${Math.round((a / b) * 100)}%`);
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
};

interface Row { run: number; pkg: string; expected: string[]; found: string[]; tp: number; fn: number; fp: number; ai: number; score: number; ms: number; error?: string }

async function analyze(dir: string) {
  const [contract, acceptance, invoice] = await Promise.all([
    extractContract(readFileSync(path.join(dir, 'contract.pdf'))),
    extractAcceptance(readFileSync(path.join(dir, 'acceptance.pdf'))),
    extractInvoice(readFileSync(path.join(dir, 'invoice.pdf'))),
  ]);
  const xmlPath = path.join(dir, 'invoice.xml');
  const xml = existsSync(xmlPath) ? parseInvoiceXml(readFileSync(xmlPath)) : null;
  const { tolerancePercent, checks } = splitRules(DEFAULT_RULES);
  const findings = [
    ...threeWayMatch(contract, acceptance, invoice, xml, tolerancePercent),
    ...checkPolicies({ contract, acceptance, invoice }, checks, contract.riskyClauses ?? []),
  ];
  return { findings, score: scoreFindings(findings).riskScore };
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= 2) throw err;
      console.warn(`  failed, waiting 30 s before retrying (${(err as Error).message.slice(0, 80)})`);
      await sleep(30_000);
    }
  }
}

async function main() {
  if (!existsSync(path.join(ROOT, 'labels.json'))) throw new Error('benchmark/labels.json is missing – run npm run gen:bench first');
  const labels: Record<string, string[]> = JSON.parse(readFileSync(path.join(ROOT, 'labels.json'), 'utf-8'));
  const pkgs = readdirSync(ROOT).filter((d) => labels[d]).sort().slice(0, LIMIT);
  const rows: Row[] = [];
  const started = new Date();

  for (let run = 1; run <= RUNS; run++) {
    for (const pkg of pkgs) {
      const expected = labels[pkg];
      const t0 = Date.now();
      try {
        const { findings, score } = await withBackoff(() => analyze(path.join(ROOT, pkg)));
        const found = [...new Set(findings.filter((f) => f.deterministic).map((f) => f.checkId))].sort();
        const tp = expected.filter((c) => found.includes(c)).length;
        rows.push({
          run, pkg, expected, found, tp, fn: expected.length - tp, fp: found.filter((c) => !expected.includes(c)).length,
          ai: findings.filter((f) => !f.deterministic).length, score, ms: Date.now() - t0,
        });
        console.log(`run ${run} ${pkg}: expected [${expected}] · found [${found}] · ${score} pts · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      } catch (err) {
        rows.push({ run, pkg, expected, found: [], tp: 0, fn: expected.length, fp: 0, ai: 0, score: -1, ms: Date.now() - t0, error: (err as Error).message });
        console.error(`run ${run} ${pkg}: FAILED ${(err as Error).message}`);
      }
      if (DELAY > 0 && modelName() !== 'mock') await sleep(DELAY);
    }
  }

  // ---- Aggregate ----
  const ok = rows.filter((r) => !r.error);
  const checks = [...new Set(Object.values(labels).flat())].sort();
  const perCheck = checks.map((c) => {
    const withC = ok.filter((r) => r.expected.includes(c));
    return `| ${c} | ${withC.filter((r) => r.found.includes(c)).length}/${withC.length} | ${pct(withC.filter((r) => r.found.includes(c)).length, withC.length)} |`;
  });
  const totalExpected = ok.reduce((s, r) => s + r.expected.length, 0);
  const totalTp = ok.reduce((s, r) => s + r.tp, 0);
  const clean = ok.filter((r) => r.expected.length === 0);
  const seconds = ok.map((r) => r.ms / 1000);
  const stability = pkgs.map((p) => {
    const scores = ok.filter((r) => r.pkg === p).map((r) => r.score);
    return scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
  });

  const md = `# OmniOps AI benchmark results

- Model: \`${modelName()}\` · Run at: ${started.toISOString()}
- ${pkgs.length} packages × ${RUNS} runs = ${rows.length} analyses (${rows.length - ok.length} failed)
- Data: synthetic documents generated by \`scripts/gen_packages.py bench\` (8 clean, 8 single-error, 4 double-error packages)

## Detection rate per check

| Check | Caught | Rate |
|---|---|---|
${perCheck.join('\n')}

## Summary

| Metric | Value |
|---|---|
| Seeded errors caught (all runs) | ${totalTp}/${totalExpected} (${pct(totalTp, totalExpected)}) |
| Deterministic false positives on clean packages | ${clean.reduce((s, r) => s + r.fp, 0)} across ${clean.length} analyses |
| Deterministic false positives on all packages | ${ok.reduce((s, r) => s + r.fp, 0)} |
| Average "AI" findings on clean packages | ${clean.length ? (clean.reduce((s, r) => s + r.ai, 0) / clean.length).toFixed(2) : '–'} |
| Time per package p50 / p95 | ${quantile(seconds, 0.5).toFixed(1)} s / ${quantile(seconds, 0.95).toFixed(1)} s |
| Largest risk-score spread across runs | ${Math.max(0, ...stability)} pts |

## Limitations

- Synthetic documents with a clean, text-based layout generated by \`scripts/gen_packages.py\`; that same script also
  defines the ground truth, so these numbers measure **pipeline correctness, not robustness to real-world documents**.
- Scanned or photographed documents are untested: the prompts assume selectable text, not OCR.
- Line items are matched by item code; a supplier who renames codes between contract and invoice is not handled.
- One supplier, one currency (VND), one VAT rate per invoice; no multi-currency and no mixed-rate invoices.
- The AI-judged part (risky clauses) is capped at 15 of 100 points by design, so a hallucinated clause can never
  flip the recommendation on its own — every status-changing finding comes from deterministic code.
`;
  writeFileSync(path.join(ROOT, 'results.md'), md);
  writeFileSync(
    path.join(ROOT, 'results.csv'),
    'run,package,expected,found,tp,fn,fp,aiFindings,riskScore,ms,error\n' +
      rows.map((r) => [r.run, r.pkg, r.expected.join(' '), r.found.join(' '), r.tp, r.fn, r.fp, r.ai, r.score, r.ms, JSON.stringify(r.error ?? '')].join(',')).join('\n') + '\n',
  );
  console.log(`\nWrote ${ROOT}/results.md and ${ROOT}/results.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
