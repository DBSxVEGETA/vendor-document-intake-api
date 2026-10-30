const pool = require("../../config/database");

const { extractInvoiceData } = require("./extractors/mock.extractor");
const { validateInvoice } = require("./document.validator");

async function processDocument({ vendorId, rawText, sourceType }) {
  // 1. Extract invoice fields from the document text.
  const extractedData = extractInvoiceData(rawText);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2. Check whether this vendor has uploaded this invoice before.
    let isDuplicate = false;

    if (extractedData.invoiceNumber) {
      const duplicateResult = await client.query(
        `SELECT id
                 FROM documents
                 WHERE vendor_id = $1
                   AND invoice_number = $2
                 LIMIT 1`,
        [vendorId, extractedData.invoiceNumber],
      );

      isDuplicate = duplicateResult.rowCount > 0;
    }

    // 3. Validate the extracted fields.
    const validatedData = validateInvoice(extractedData, isDuplicate);

    // 4. Save the document, including invalid fields and flags.
    const result = await client.query(
      `INSERT INTO documents (
                vendor_id,
                status,
                source_type,
                raw_text,
                vendor_name,
                invoice_number,
                invoice_date,
                total,
                flags
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING
                id,
                vendor_id,
                status,
                source_type,
                vendor_name,
                invoice_number,
                invoice_date,
                total,
                currency,
                flags,
                created_at`,
      [
        vendorId,
        validatedData.status,
        sourceType,
        rawText,
        validatedData.vendorName,
        validatedData.invoiceNumber,
        validatedData.invoiceDate,
        validatedData.total,
        JSON.stringify(validatedData.flags),
      ],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getDocuments(user, { page = 1, limit = 10 } = {}) {
  const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const parsedLimit = Math.min(
    100,
    Math.max(1, Number.parseInt(limit, 10) || 10),
  );

  const offset = (parsedPage - 1) * parsedLimit;

  const isVendor = user.role === "vendor";

  const whereClause = isVendor ? "WHERE vendor_id = $1" : "";

  const queryParams = isVendor
    ? [user.id, parsedLimit, offset]
    : [parsedLimit, offset];

  const limitIndex = isVendor ? "$2" : "$1";
  const offsetIndex = isVendor ? "$3" : "$2";

  const result = await pool.query(
    `SELECT
            id,
            vendor_id,
            status,
            vendor_name,
            invoice_number,
            invoice_date,
            total,
            currency,
            flags,
            created_at
         FROM documents
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${limitIndex}
         OFFSET ${offsetIndex}`,
    queryParams,
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
         FROM documents
         ${whereClause}`,
    isVendor ? [user.id] : [],
  );

  return {
    documents: result.rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total: Number(countResult.rows[0].total),
      totalPages: Math.ceil(Number(countResult.rows[0].total) / parsedLimit),
    },
  };
}

async function getDocumentById(documentId, user) {
  const isVendor = user.role === "vendor";

  const query = isVendor
    ? `SELECT * FROM documents
           WHERE id = $1 AND vendor_id = $2`
    : `SELECT * FROM documents
           WHERE id = $1`;

  const params = isVendor ? [documentId, user.id] : [documentId];

  const result = await pool.query(query, params);

  if (result.rowCount === 0) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

async function approveDocument(documentId, reviewerId) {
  const result = await pool.query(
    `UPDATE documents
         SET status = 'approved',
             reviewed_by = $2,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND status IN ('extracted', 'needs_review')
         RETURNING *`,
    [documentId, reviewerId],
  );

  if (result.rowCount === 0) {
    const existing = await pool.query(
      "SELECT id FROM documents WHERE id = $1",
      [documentId],
    );

    if (existing.rowCount === 0) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      throw error;
    }

    const error = new Error(
      "Document cannot be approved in its current status",
    );
    error.statusCode = 409;
    throw error;
  }

  return result.rows[0];
}

async function rejectDocument(documentId, reviewerId, reason) {
  if (!reason || !reason.trim()) {
    const error = new Error("Rejection reason is required");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `UPDATE documents
         SET status = 'rejected',
             rejection_reason = $3,
             reviewed_by = $2,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND status IN ('extracted', 'needs_review')
         RETURNING *`,
    [documentId, reviewerId, reason.trim()],
  );

  if (result.rowCount === 0) {
    const existing = await pool.query(
      "SELECT id FROM documents WHERE id = $1",
      [documentId],
    );

    if (existing.rowCount === 0) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      throw error;
    }

    const error = new Error(
      "Document cannot be rejected in its current status",
    );
    error.statusCode = 409;
    throw error;
  }

  return result.rows[0];
}

module.exports = {
  processDocument,
  getDocuments,
  getDocumentById,
  approveDocument,
  rejectDocument,
};
