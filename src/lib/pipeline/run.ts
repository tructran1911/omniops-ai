import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { readFile } from '@/lib/storage';
import { modelName } from '@/lib/gemini';
import { audit } from '@/lib/audit';
import { extractDoc, PROMPTS_HASH } from './extract';
import { parseInvoiceXml } from './invoiceXml';
import { threeWayMatch } from './threeWayMatch';
import { checkPolicies, DEFAULT_RULES, splitRules } from './policy';
import { scoreFindings } from './score';
import { summarize } from './summarize';
import { sha256 } from './hash';
import type { DocRef, DocType, Extracted, PdfDocType, PolicyRule, ProgressStep } from '@/types/domain';

const PDF_TYPES: PdfDocType[] = ['contract', 'acceptance', 'invoice'];

const STEP_LABELS: Record<ProgressStep, string> = {
  extract: 'Extracting the 3 documents with Gemini…',
  match: 'Running the 3-way match…',
  policy: 'Checking company policy…',
  score: 'Scoring the risk and drafting the summary…',
  done: 'Done',
};

export interface PipelineInput {
  pkgId: string;
  version: number;
  docs: Partial<Record<DocType, DocRef>>;
  /** Previous run (on resubmit): unchanged documents reuse the old extraction instead of calling Gemini again. */
  previous?: { docs: Partial<Record<DocType, DocRef>>; extracted?: Extracted };
}

export async function loadPolicyRules(): Promise<PolicyRule[]> {
  const snap = await adminDb().collection('policy_rules').get();
  return snap.empty ? DEFAULT_RULES : snap.docs.map((d) => ({ ...(d.data() as PolicyRule), id: d.id }));
}

/** Extraction cached by file sha256 (golden cache: once a sample package has run, the result is always available). */
async function extractCached(docType: PdfDocType, pdf: Buffer): Promise<{ data: unknown; fromCache: boolean }> {
  const model = modelName();
  const ref = adminDb().doc(`extraction_cache/${sha256(pdf)}_${docType}_${model}`);
  const hit = await ref.get();
  if (hit.exists) return { data: hit.get('data'), fromCache: true };
  const data = await extractDoc(docType, pdf);
  await ref.set({ data, model, docType, createdAt: FieldValue.serverTimestamp() });
  return { data, fromCache: false };
}

/** Run the whole pipeline for one package version and write the result to Firestore. MUST be awaited inside the route. */
export async function runPipeline({ pkgId, version, docs, previous }: PipelineInput): Promise<void> {
  const db = adminDb();
  const pkgRef = db.doc(`packages/${pkgId}`);
  const startedAt = Date.now();
  const setProgress = (step: ProgressStep) =>
    pkgRef.update({
      progress: { step, label: STEP_LABELS[step], startedAt, ...(step === 'done' ? { finishedAt: Date.now() } : {}) },
      updatedAt: FieldValue.serverTimestamp(),
    });

  try {
    await setProgress('extract');
    let usedCache = false;
    const results = await Promise.all(PDF_TYPES.map(async (t) => {
      const ref = docs[t];
      if (!ref) throw new Error(`Missing document: ${t}`);
      const prevRef = previous?.docs[t];
      if (prevRef && prevRef.sha256 === ref.sha256 && previous?.extracted?.[t]) {
        usedCache = true;
        return previous.extracted[t];
      }
      const r = await extractCached(t, await readFile(ref.storagePath));
      usedCache ||= r.fromCache;
      return r.data;
    }));
    const extracted = {
      contract: results[0],
      acceptance: results[1],
      invoice: results[2],
      invoiceXml: docs.invoiceXml ? parseInvoiceXml(await readFile(docs.invoiceXml.storagePath)) : null,
    } as Extracted;

    await setProgress('match');
    const { tolerancePercent, checks } = splitRules(await loadPolicyRules());
    const matchFindings = threeWayMatch(extracted.contract, extracted.acceptance, extracted.invoice, extracted.invoiceXml, tolerancePercent);

    await setProgress('policy');
    const policyFindings = checkPolicies(extracted, checks, extracted.contract.riskyClauses ?? []);

    await setProgress('score');
    const findings = [...matchFindings, ...policyFindings];
    const score = scoreFindings(findings);
    const { summary, fixRequestDraft } = await summarize(findings, score);

    const batch = db.batch();
    findings.forEach((f, n) => {
      batch.set(pkgRef.collection('findings').doc(`v${version}-${String(n + 1).padStart(2, '0')}`), { ...f, version });
    });
    const processingMs = Date.now() - startedAt;
    batch.update(pkgRef, {
      status: 'pending_review',
      extracted,
      ...score,
      summary,
      fixRequestDraft,
      findingCount: findings.length,
      history: FieldValue.arrayUnion({ version, riskScore: score.riskScore }),
      processingMs,
      usedCache,
      errorMessage: FieldValue.delete(),
      progress: { step: 'done', label: STEP_LABELS.done, startedAt, finishedAt: Date.now() },
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    await audit({
      packageId: pkgId, actorUid: 'system', actorName: 'OmniOps AI', actorRole: 'system', action: 'analysis.completed',
      version, model: modelName(), promptHash: PROMPTS_HASH, resultHash: sha256(JSON.stringify(findings)),
      detail: `Score ${score.riskScore}/100 · ${findings.length} finding(s) · ${(processingMs / 1000).toFixed(1)} s${usedCache ? ' · cache hit' : ''}`,
    });
  } catch (err) {
    console.error(`[pipeline] ${pkgId} v${version} failed:`, err);
    const message = err instanceof Error && err.message.startsWith('Mock mode')
      ? err.message
      : 'Could not analyze this package (the AI service failed or a file could not be read). Please try again.';
    await pkgRef.update({ status: 'error', errorMessage: message, updatedAt: FieldValue.serverTimestamp() });
    await audit({
      packageId: pkgId, actorUid: 'system', actorName: 'OmniOps AI', actorRole: 'system', action: 'analysis.failed',
      version, model: modelName(), detail: err instanceof Error ? err.message.slice(0, 300) : String(err),
    });
  }
}
