const { validateInvoice } = require("../modules/documents/document.validator");

const validInvoice = {
  vendorName: "ABC Technologies",
  invoiceNumber: "INV-001",
  invoiceDate: "2026-10-20",
  total: "15000.50",
};

const missingInvoiceNumber = {
  ...validInvoice,
  invoiceNumber: null,
};

const negativeTotal = {
  ...validInvoice,
  total: "-500.00",
};

const futureDate = {
  ...validInvoice,
  invoiceDate: "2099-01-01",
};

console.log("Valid:", validateInvoice(validInvoice));
console.log("Missing number:", validateInvoice(missingInvoiceNumber));
console.log("Negative total:", validateInvoice(negativeTotal));
console.log("Future date:", validateInvoice(futureDate));
console.log("Duplicate:", validateInvoice(validInvoice, true));
