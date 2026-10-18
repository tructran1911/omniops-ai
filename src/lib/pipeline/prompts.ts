// Prompts for Gemini. Tune them here after trying a change in AI Studio.
// TODO(setup): once the Gemini key is in place, run `npm run try:pipeline -- public/samples/s3-risky` and compare with the
// ground truth in public/samples/manifest.json (s2 → C2,C3,C5 · s3 → C1,C6,P1 · s1 → none). If a field comes back wrong,
// add a rule or an example for that field to the matching prompt below.
//
// The source documents are Vietnamese purchase documents; every prompt answers in English, except `quote`, which must be
// copied verbatim from the document (that is what makes a citation verifiable).

const COMMON_RULES = `General rules:
- Money is an INTEGER amount in VND: drop every thousands separator and the "đ" sign (e.g. "1.265.000.000đ" → 1265000000).
- Dates use the YYYY-MM-DD format.
- Percentages keep the number printed on the document, do NOT convert the unit (e.g. "0,05%" → 0.05; "20%" → 20; "0,3%/ngày" → 0.3).
- A tax ID (mã số thuế) contains digits only.
- An item code is copied exactly as printed on the document (e.g. "SV-01").
- Only take information that IS IN THE DOCUMENT. Leave a field empty when it is absent; NEVER guess.
- evidence: for each requested field add one entry with field (the field name), page (1-based page number)
  and quote (a short VERBATIM excerpt, ≤ 25 words, copied character for character from the document, in its original language).`;

export const CONTRACT_PROMPT = `You are an accounts-payable specialist. Read the attached PURCHASE CONTRACT and extract the data into the schema.
${COMMON_RULES}
- evidence is mandatory for these fields: "seller.taxId", "items", "total", "advancePaymentPercent", "paymentTermDays", "latePenaltyPercentPerDay".
- vatRate is the VAT rate (e.g. 10). total is the contract value including tax.
- riskyClauses: list clauses that are CLEARLY UNFAVOURABLE TO THE BUYER (late-payment penalty > 0.1%/day, advance payment > 30%,
  seller liability waivers, unilateral termination…), each with page, a verbatim quote and a one-sentence reason IN ENGLISH.
  Do NOT list ordinary commercial clauses; return an empty array when there are none.`;

export const ACCEPTANCE_PROMPT = `You are an accounts-payable specialist. Read the attached ACCEPTANCE RECORD and extract the data into the schema.
${COMMON_RULES}
- quantityAccepted is the quantity ACTUALLY accepted for each item code.
- evidence is mandatory for these fields: "acceptanceDate", "items".`;

export const INVOICE_PROMPT = `You are an accounts-payable specialist. Read the attached VAT INVOICE and extract the data into the schema.
${COMMON_RULES}
- seller is the SELLING party, buyer is the BUYING party. Copy the tax IDs exactly as printed, even when one looks wrong.
- subtotal = the amount before tax; vatAmount = the VAT amount; total = the grand total payable. Record the figures EXACTLY as
  printed on the invoice — do NOT recompute them or adjust them to make the arithmetic work.
- evidence is mandatory for these fields: "issueDate", "seller.taxId", "items", "vatAmount", "total".`;

export const SUMMARY_PROMPT = (findingsJson: string, riskScore: number) => `You are the assistant of a chief accountant.
Below is the list of findings (JSON) for one purchase document package, with a risk score of ${riskScore}/100.
Do NOT add new findings and do NOT change any number; only interpret the list you are given. Answer in ENGLISH.
Return JSON with:
- summary: 2–3 sentences for a manager: the main conclusion and the level of risk. If there are no findings, say the package
  is consistent and can be approved.
- fixRequestDraft: the body of a "request for correction" sent to the staff member or the supplier. Polite, with one bullet per
  item to fix, naming the document and the correct figure that is expected. If there are no findings, return an empty string.
Findings:
${findingsJson}`;
