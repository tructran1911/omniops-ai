// The 7 deterministic 3-way checks (docs/PROJECT_DOCUMENTATION.md §4). Pure functions: no network, no Firestore.
import type {
  AcceptanceData, ContractData, DocType, Evidence, FindingEvidence, InvoiceData, InvoiceXmlData, NewFinding,
} from '@/types/domain';

export const digits = (s?: string) => (s ?? '').replace(/\D/g, '');
export const normCode = (s?: string) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const vnd = (n: number) => `${Math.round(n).toLocaleString('en-US')} VND`;

/** Pick the evidence (page + quote) for a field name; returns nothing when the document has none. */
export function ev(docType: DocType, doc: { evidence?: Evidence[] }, field: string): FindingEvidence[] {
  const e = doc.evidence?.find((x) => x.field === field) ?? doc.evidence?.find((x) => x.field.startsWith(field));
  return e?.quote ? [{ docType, page: e.page, quote: e.quote }] : [];
}

export function threeWayMatch(
  c: ContractData,
  a: AcceptanceData,
  i: InvoiceData,
  x: InvoiceXmlData | null | undefined,
  tolerancePercent: number,
): NewFinding[] {
  const out: NewFinding[] = [];

  // C1 – seller tax ID
  if (digits(i.seller?.taxId) !== digits(c.seller?.taxId)) {
    out.push({
      checkId: 'C1', category: 'tax_id', severity: 'critical', points: 35, deterministic: true,
      title: 'Seller tax ID on the invoice differs from the contract',
      explanation: `The invoice shows tax ID ${i.seller?.taxId || '(empty)'} while the contract shows ${c.seller?.taxId || '(empty)'}. The invoice may not have been issued by the contracted supplier.`,
      evidence: [...ev('invoice', i, 'seller'), ...ev('contract', c, 'seller')],
    });
  }

  // C2 – invoice total vs. contract total (tolerance comes from the policy rules)
  const diff = Math.abs(i.total - c.total);
  if (diff > (c.total * tolerancePercent) / 100) {
    out.push({
      checkId: 'C2', category: 'amount', severity: 'high', points: 20, deterministic: true,
      title: 'Invoice total does not match the contract',
      explanation: `The invoice charges ${vnd(i.total)} against a contract value of ${vnd(c.total)}: a gap of ${vnd(diff)}, above the ${tolerancePercent.toLocaleString('en-US')}% tolerance.`,
      evidence: [...ev('invoice', i, 'total'), ...ev('contract', c, 'total')],
    });
  }

  // C3 – VAT arithmetic on the invoice itself
  const expectedVat = Math.round((i.subtotal * i.vatRate) / 100);
  const vatWrong = Math.abs(expectedVat - i.vatAmount) > 1000;
  const sumWrong = Math.abs(i.subtotal + i.vatAmount - i.total) > 1000;
  if (vatWrong || sumWrong) {
    out.push({
      checkId: 'C3', category: 'vat', severity: 'high', points: 20, deterministic: true,
      title: 'VAT amount on the invoice is miscalculated',
      explanation: vatWrong
        ? `Subtotal ${vnd(i.subtotal)} × ${i.vatRate}% = ${vnd(expectedVat)}, but the invoice states a VAT amount of ${vnd(i.vatAmount)}.`
        : `Subtotal ${vnd(i.subtotal)} + VAT ${vnd(i.vatAmount)} ≠ the stated grand total ${vnd(i.total)}.`,
      evidence: [...ev('invoice', i, 'vatAmount'), ...ev('invoice', i, 'total')],
    });
  }

  // C4 – invoiced quantity must not exceed the accepted quantity
  for (const line of i.items) {
    const acc = a.items.find((it) => normCode(it.code) === normCode(line.code));
    if (!acc || line.quantity > acc.quantityAccepted) {
      out.push({
        checkId: 'C4', category: 'quantity', severity: 'high', points: 20, deterministic: true,
        title: `Invoiced quantity for ${line.code} exceeds the accepted quantity`,
        explanation: acc
          ? `The invoice bills ${line.quantity}, while the acceptance record only confirms ${acc.quantityAccepted}.`
          : `Item ${line.code} appears on the invoice but not in the acceptance record.`,
        evidence: [...ev('invoice', i, 'items'), ...ev('acceptance', a, 'items')],
      });
    }
  }

  // C5 – invoice unit price must match the contract
  for (const line of i.items) {
    const cl = c.items.find((it) => normCode(it.code) === normCode(line.code));
    if (cl && line.unitPrice !== cl.unitPrice) {
      out.push({
        checkId: 'C5', category: 'unit_price', severity: 'high', points: 20, deterministic: true,
        title: `Unit price for ${line.code} differs from the contract`,
        explanation: `The invoice charges ${vnd(line.unitPrice)}/unit against ${vnd(cl.unitPrice)}/unit in the contract (a gap of ${vnd(line.unitPrice - cl.unitPrice)} × ${line.quantity}).`,
        evidence: [...ev('invoice', i, 'items'), ...ev('contract', c, 'items')],
      });
    }
  }

  // C6 – the invoice must not be issued before the acceptance date
  if (i.issueDate && a.acceptanceDate && i.issueDate < a.acceptanceDate) {
    out.push({
      checkId: 'C6', category: 'date_order', severity: 'medium', points: 10, deterministic: true,
      title: 'Invoice was issued before the goods were accepted',
      explanation: `The invoice is dated ${i.issueDate}, but the goods were only accepted on ${a.acceptanceDate}.`,
      evidence: [...ev('invoice', i, 'issueDate'), ...ev('acceptance', a, 'acceptanceDate')],
    });
  }

  // C7 – e-invoice XML must agree with the PDF
  if (x) {
    const totalMismatch = x.total !== undefined && Math.abs(x.total - i.total) > 0;
    const taxMismatch = x.sellerTaxId !== undefined && digits(x.sellerTaxId) !== digits(i.seller?.taxId);
    if (totalMismatch || taxMismatch) {
      const parts = [
        totalMismatch ? `grand total in the XML ${vnd(x.total!)} ≠ ${vnd(i.total)} on the PDF` : '',
        taxMismatch ? `seller tax ID in the XML ${x.sellerTaxId} ≠ ${i.seller?.taxId} on the PDF` : '',
      ].filter(Boolean);
      out.push({
        checkId: 'C7', category: 'xml_mismatch', severity: 'critical', points: 35, deterministic: true,
        title: 'E-invoice XML does not match the PDF',
        explanation: `${parts.join('; ')}. The XML is the legally authoritative original, so the PDF may have been altered.`,
        evidence: [
          { docType: 'invoiceXml', quote: `TgTTTBSo=${x.total ?? '?'}; MST=${x.sellerTaxId ?? '?'}` },
          ...ev('invoice', i, 'total'),
        ],
      });
    }
  }

  return out;
}
