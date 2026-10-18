import { XMLParser } from 'fast-xml-parser';
import type { InvoiceXmlData } from '@/types/domain';

// Parse the Vietnamese e-invoice XML (Decree 123/2020, Circular 78/2021 format) in code — no AI involved.
// Tags: HDon/DLHDon/TTChung/{SHDon,NLap} · NDHDon/NBan/MST · NDHDon/TToan/{TgTCThue,TgTThue,TgTTTBSo}
export function parseInvoiceXml(xml: Buffer | string): InvoiceXmlData {
  const parser = new XMLParser({ parseTagValue: false, ignoreAttributes: true });
  const doc = parser.parse(typeof xml === 'string' ? xml : xml.toString('utf-8'));
  const dl = doc?.HDon?.DLHDon;
  if (!dl) throw new Error('The XML file is not a valid e-invoice (HDon/DLHDon is missing)');

  const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(String(v).replace(/[^\d.-]/g, '')));
  const str = (v: unknown) => (v === undefined ? undefined : String(v).trim());
  return {
    invoiceNo: str(dl.TTChung?.SHDon),
    issueDate: str(dl.TTChung?.NLap),
    sellerTaxId: str(dl.NDHDon?.NBan?.MST),
    subtotal: num(dl.NDHDon?.TToan?.TgTCThue),
    vatAmount: num(dl.NDHDon?.TToan?.TgTThue),
    total: num(dl.NDHDon?.TToan?.TgTTTBSo),
  };
}
