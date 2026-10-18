// Shared types for the pipeline, the API routes and the UI (docs/PROJECT_DOCUMENTATION.md §2, §4).

export type Role = 'staff' | 'manager';
export type PackageStatus = 'analyzing' | 'pending_review' | 'needs_fix' | 'approved' | 'rejected' | 'error';
export type PdfDocType = 'contract' | 'acceptance' | 'invoice';
export type DocType = PdfDocType | 'invoiceXml';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type RiskLevel = Severity;
export type SuggestedAction = 'APPROVE' | 'REQUEST_FIX' | 'REJECT';
export type DecisionAction = 'approve' | 'request_fix' | 'reject';
export type ProgressStep = 'extract' | 'match' | 'policy' | 'score' | 'done';

export type FindingCategory =
  | 'tax_id' | 'amount' | 'vat' | 'quantity' | 'unit_price' | 'date_order' | 'xml_mismatch' | 'policy' | 'clause';

/** C1–C7: deterministic code checks · P*: policy rules · AI: clause risk judged by Gemini */
export type CheckId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'AI' | (string & {});

export const DOC_LABELS: Record<DocType, string> = {
  contract: 'Contract',
  acceptance: 'Acceptance record',
  invoice: 'VAT invoice',
  invoiceXml: 'Invoice XML',
};

// ---------- Extracted data (money: integer VND · dates: YYYY-MM-DD · percent: 0.05 means 0.05%) ----------

export interface Evidence {
  field: string;   // field name, e.g. "seller.taxId", "total"
  page: number;    // page number, 1-based
  quote: string;   // short verbatim quote from the document
}

export interface Party { name: string; taxId: string }

export interface RiskyClause { page: number; quote: string; reason: string }

export interface ContractData {
  contractNo: string;
  signDate?: string;
  seller: Party;
  buyer: Party;
  items: { code: string; description?: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  vatRate: number;
  total: number;
  advancePaymentPercent?: number;
  paymentTermDays?: number;
  latePenaltyPercentPerDay?: number;
  riskyClauses?: RiskyClause[];
  evidence: Evidence[];
}

export interface AcceptanceData {
  acceptanceNo: string;
  contractNo?: string;
  acceptanceDate: string;
  items: { code: string; description?: string; quantityAccepted: number }[];
  evidence: Evidence[];
}

export interface InvoiceData {
  invoiceNo: string;
  series?: string;
  issueDate: string;
  seller: Party;
  buyer?: Party;
  items: { code: string; description?: string; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  evidence: Evidence[];
}

/** Parsed from the Vietnamese e-invoice XML (Circular 78/2021) by code — no AI involved */
export interface InvoiceXmlData {
  invoiceNo?: string;
  issueDate?: string;
  sellerTaxId?: string;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
}

export interface Extracted {
  contract: ContractData;
  acceptance: AcceptanceData;
  invoice: InvoiceData;
  invoiceXml?: InvoiceXmlData | null;
}

// ---------- Findings & scoring ----------

export interface FindingEvidence { docType: DocType; page?: number; quote: string }

export interface NewFinding {
  checkId: CheckId;
  category: FindingCategory;
  severity: Severity;
  title: string;
  explanation: string;
  evidence: FindingEvidence[];
  deterministic: boolean; // true = code check · false = AI judgement
  points: number;         // points added to the risk score
}

export interface Finding extends NewFinding { id: string; version: number }

export interface ScoreResult {
  riskScore: number;
  riskLevel: RiskLevel;
  suggestedAction: SuggestedAction;
  scoreBreakdown: { checkId: CheckId; title: string; points: number }[];
}

// ---------- Firestore ----------

export interface PolicyRule {
  id: string;            // "P1", "P2", … or "TOL" (total-amount tolerance used by C2)
  name: string;
  field: string;         // dotted path inside { contract, acceptance, invoice }, e.g. "contract.latePenaltyPercentPerDay"
  operator: 'lte' | 'gte';
  value: number;
  unit: string;
  severity: Severity;
  points: number;
  enabled: boolean;
}

export interface DocRef { storagePath: string; fileName: string; sha256: string; size: number }

export interface UserProfile { role: Role; displayName: string; isDemo: boolean }

/** Firestore Timestamp – call .toDate() on the client */
export interface TimestampLike { toDate(): Date; toMillis(): number }

export interface PackageDoc {
  title: string;
  sampleId?: string;   // created from a built-in sample package (demo mode)
  ownerUid: string;
  ownerName: string;
  status: PackageStatus;
  version: number;
  docs: Partial<Record<DocType, DocRef>>;
  progress?: { step: ProgressStep; label: string; startedAt: number; finishedAt?: number };
  riskScore?: number;
  riskLevel?: RiskLevel;
  scoreBreakdown?: ScoreResult['scoreBreakdown'];
  suggestedAction?: SuggestedAction;
  summary?: string;
  fixRequestDraft?: string;
  findingCount?: number;
  extracted?: Extracted;
  history?: { version: number; riskScore: number }[];
  lastDecision?: { action: DecisionAction; comment: string; byName: string; at: number };
  processingMs?: number;
  usedCache?: boolean;
  errorMessage?: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface ApprovalDoc {
  action: DecisionAction | 'resubmit';
  comment: string;
  byUid: string;
  byName: string;
  version: number;
  at: TimestampLike;
}

export type AuditAction =
  | 'package.created' | 'analysis.completed' | 'analysis.failed'
  | 'decision.approve' | 'decision.request_fix' | 'decision.reject'
  | 'package.resubmitted' | 'policy.updated';

export interface AuditEntry {
  packageId?: string;
  actorUid: string;
  actorName: string;
  actorRole: Role | 'system';
  action: AuditAction;
  version?: number;
  model?: string;
  promptHash?: string;
  resultHash?: string;
  detail?: string;
  at: TimestampLike;
}
