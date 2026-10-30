function extractInvoiceData(text) {
  if (!text || typeof text !== "string" || !text.trim()) {
    const error = new Error("Document contains no readable text");
    error.statusCode = 422;
    throw error;
  }

  function extractField(label) {
    const regex = new RegExp(`^\\s*${label}\\s*:\\s*(.*?)\\s*$`, "im");

    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  return {
    vendorName: extractField("Vendor"),
    invoiceNumber: extractField("Invoice Number"),
    invoiceDate: extractField("Date"),
    total: extractField("Total"),
  };
}

module.exports = {
  extractInvoiceData,
};
