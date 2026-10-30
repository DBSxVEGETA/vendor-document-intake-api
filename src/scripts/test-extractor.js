const {
  extractInvoiceData,
} = require("../modules/documents/extractors/mock.extractor");

const sampleInvoice = `
Vendor: ABC Technologies
Invoice Number: INV-2026-001
Date: 2026-10-20
Total: 15000.50
`;

const result = extractInvoiceData(sampleInvoice);

console.log("Extracted invoice data:");
console.log(result);
