function validateInvoice(data, isDuplicate = false) {
  const flags = [];
  const normalized = {
    vendorName: data.vendorName?.trim() || null,
    invoiceNumber: data.invoiceNumber?.trim() || null,
    invoiceDate: null,
    total: null,
  };

  if (!normalized.vendorName) {
    flags.push("MISSING_VENDOR");
  }

  if (!normalized.invoiceNumber) {
    flags.push("MISSING_INVOICE_NUMBER");
  }

  // Validate invoice date using the YYYY-MM-DD format.
  if (!data.invoiceDate) {
    flags.push("MISSING_DATE");
  } else {
    const dateString = data.invoiceDate.trim();
    const date = new Date(`${dateString}T00:00:00Z`);

    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
    const validDate =
      validFormat &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === dateString;

    if (!validDate) {
      flags.push("INVALID_DATE");
    } else if (dateString > new Date().toISOString().slice(0, 10)) {
      flags.push("FUTURE_DATE");
      normalized.invoiceDate = dateString;
    } else {
      normalized.invoiceDate = dateString;
    }
  }

  // Validate monetary value without floating-point arithmetic.
  if (!data.total) {
    flags.push("MISSING_TOTAL");
  } else {
    const totalString = data.total.trim();
    const validAmount = /^-?\d+(\.\d{1,2})?$/.test(totalString);

    if (!validAmount) {
      flags.push("INVALID_TOTAL");
    } else {
      const [integerPart, decimalPart = ""] = totalString.split(".");
      const integerDigits =
        integerPart.replace("-", "").replace(/^0+/, "") || "0";

      if (integerDigits.length > 10) {
        flags.push("INVALID_TOTAL");
      } else {
        normalized.total = totalString;

        if (Number(totalString) <= 0) {
          flags.push("NON_POSITIVE_TOTAL");
        }
      }
    }
  }

  if (isDuplicate && normalized.invoiceNumber) {
    flags.push("DUPLICATE_INVOICE");
  }

  return {
    ...normalized,
    flags,
    status: flags.length > 0 ? "needs_review" : "extracted",
  };
}

module.exports = { validateInvoice };
