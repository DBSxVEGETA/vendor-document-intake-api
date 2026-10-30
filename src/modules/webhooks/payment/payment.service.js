const crypto = require("crypto");
const pool = require("../../../config/database");

function verifySignature(rawBody, signature) {
  if (!rawBody || !signature || !process.env.WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const supplied = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
}

async function processPaymentEvent(payload) {
  const { eventId, documentId, amount } = payload;

  if (!eventId || !documentId || amount === undefined || amount === null) {
    const error = new Error("eventId, documentId and amount are required");
    error.statusCode = 400;
    throw error;
  }

  // Validate the amount as a decimal string.
  const amountString = String(amount);

  if (!/^\d+(\.\d{1,2})?$/.test(amountString)) {
    const error = new Error("Invalid payment amount");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the document so concurrent payment events cannot
    // independently change its state.
    const documentResult = await client.query(
      `SELECT id, status, total
             FROM documents
             WHERE id = $1
             FOR UPDATE`,
      [documentId],
    );

    if (documentResult.rowCount === 0) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      throw error;
    }

    const document = documentResult.rows[0];

    // The unique event_id constraint makes this idempotent.
    const eventResult = await client.query(
      `INSERT INTO payment_events
                (event_id, document_id, payload, result)
             VALUES ($1, $2, $3, 'processing')
             ON CONFLICT (event_id) DO NOTHING
             RETURNING id`,
      [eventId, documentId, JSON.stringify(payload)],
    );

    if (eventResult.rowCount === 0) {
      await client.query("COMMIT");

      return {
        duplicate: true,
        message: "Payment event already processed",
      };
    }

    let eventOutcome;

    if (document.status !== "approved") {
      eventOutcome = "rejected_invalid_status";
    } else {
      // Compare money inside PostgreSQL to avoid floating-point errors.
      const amountResult = await client.query(
        `SELECT ($1::numeric = $2::numeric) AS matches`,
        [amountString, document.total],
      );

      if (!amountResult.rows[0].matches) {
        eventOutcome = "rejected_amount_mismatch";
      } else {
        await client.query(
          `UPDATE documents
                     SET status = 'paid',
                         paid_at = NOW(),
                         updated_at = NOW()
                     WHERE id = $1`,
          [documentId],
        );

        eventOutcome = "processed";
      }
    }

    await client.query(
      `UPDATE payment_events
             SET result = $1
             WHERE event_id = $2`,
      [eventOutcome, eventId],
    );

    await client.query("COMMIT");

    if (eventOutcome === "rejected_invalid_status") {
      const error = new Error("Only approved documents can be marked as paid");
      error.statusCode = 409;
      throw error;
    }

    if (eventOutcome === "rejected_amount_mismatch") {
      const error = new Error(
        "Payment amount does not match the invoice total",
      );
      error.statusCode = 409;
      throw error;
    }

    return {
      duplicate: false,
      message: "Payment processed successfully",
      documentId,
      status: "paid",
    };
  } catch (error) {
    // A transaction may already have been committed for a recorded
    // business rejection. Rollback is harmless in that case.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  verifySignature,
  processPaymentEvent,
};
