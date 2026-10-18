// JSON Schemas passed to Gemini via responseJsonSchema (docs/PROJECT_DOCUMENTATION.md §2).

const party = {
  type: 'object',
  properties: { name: { type: 'string' }, taxId: { type: 'string', description: 'Tax ID (mã số thuế), digits only' } },
  required: ['name', 'taxId'],
};

const evidence = {
  type: 'array',
  description: 'Evidence for each key field: the 1-based page number and a short verbatim quote',
  items: {
    type: 'object',
    properties: { field: { type: 'string' }, page: { type: 'integer' }, quote: { type: 'string' } },
    required: ['field', 'page', 'quote'],
  },
};

export const contractSchema = {
  type: 'object',
  properties: {
    contractNo: { type: 'string' },
    signDate: { type: 'string', description: 'YYYY-MM-DD' },
    seller: party,
    buyer: party,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' }, description: { type: 'string' },
          quantity: { type: 'number' }, unitPrice: { type: 'integer' },
        },
        required: ['code', 'quantity', 'unitPrice'],
      },
    },
    subtotal: { type: 'integer' },
    vatRate: { type: 'number' },
    total: { type: 'integer' },
    advancePaymentPercent: { type: 'number' },
    paymentTermDays: { type: 'integer' },
    latePenaltyPercentPerDay: { type: 'number' },
    riskyClauses: {
      type: 'array',
      description: 'Clauses that are unfavourable to the buyer',
      items: {
        type: 'object',
        properties: { page: { type: 'integer' }, quote: { type: 'string' }, reason: { type: 'string' } },
        required: ['page', 'quote', 'reason'],
      },
    },
    evidence,
  },
  required: ['contractNo', 'seller', 'buyer', 'items', 'subtotal', 'vatRate', 'total', 'evidence'],
};

export const acceptanceSchema = {
  type: 'object',
  properties: {
    acceptanceNo: { type: 'string' },
    contractNo: { type: 'string' },
    acceptanceDate: { type: 'string', description: 'YYYY-MM-DD' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { code: { type: 'string' }, description: { type: 'string' }, quantityAccepted: { type: 'number' } },
        required: ['code', 'quantityAccepted'],
      },
    },
    evidence,
  },
  required: ['acceptanceNo', 'acceptanceDate', 'items', 'evidence'],
};

export const invoiceSchema = {
  type: 'object',
  properties: {
    invoiceNo: { type: 'string' },
    series: { type: 'string' },
    issueDate: { type: 'string', description: 'YYYY-MM-DD' },
    seller: party,
    buyer: party,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' }, description: { type: 'string' }, quantity: { type: 'number' },
          unitPrice: { type: 'integer' }, amount: { type: 'integer' },
        },
        required: ['code', 'quantity', 'unitPrice', 'amount'],
      },
    },
    subtotal: { type: 'integer' },
    vatRate: { type: 'number' },
    vatAmount: { type: 'integer' },
    total: { type: 'integer' },
    evidence,
  },
  required: ['invoiceNo', 'issueDate', 'seller', 'items', 'subtotal', 'vatRate', 'vatAmount', 'total', 'evidence'],
};

export const summarySchema = {
  type: 'object',
  properties: { summary: { type: 'string' }, fixRequestDraft: { type: 'string' } },
  required: ['summary', 'fixRequestDraft'],
};
