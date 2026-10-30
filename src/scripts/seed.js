require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("../config/database");

// Development-only credentials.
// Never use these passwords in production.
const SEED_PASSWORD = "VendorAPI@123";

const USERS = [
  { email: "vendor1@example.com", role: "vendor" },
  { email: "vendor2@example.com", role: "vendor" },
  { email: "reviewer@example.com", role: "reviewer" },
  { email: "admin@example.com", role: "admin" },
];

const DOCUMENT_IDS = {
  extracted: "11111111-1111-4111-8111-111111111111",
  missingInvoice: "22222222-2222-4222-8222-222222222222",
  duplicate: "33333333-3333-4333-8333-333333333333",
  approved: "44444444-4444-4444-8444-444444444444",
  rejected: "55555555-5555-4555-8555-555555555555",
  paid: "66666666-6666-4666-8666-666666666666",
};

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("Creating seed users...");

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
    const userIds = {};

    for (const user of USERS) {
      const result = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active)
                 VALUES ($1, $2, $3, TRUE)
                 ON CONFLICT (email)
                 DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    role = EXCLUDED.role,
                    is_active = TRUE
                 RETURNING id, email, role`,
        [user.email, passwordHash, user.role],
      );

      userIds[user.role === "vendor" ? user.email : user.role] =
        result.rows[0].id;
    }

    const vendor1 = userIds["vendor1@example.com"];
    const vendor2 = userIds["vendor2@example.com"];
    const reviewer = userIds.reviewer;

    console.log("Creating sample documents...");

    const documents = [
      {
        id: DOCUMENT_IDS.extracted,
        vendorId: vendor1,
        status: "extracted",
        vendorName: "BluePeak Office Supplies Pvt. Ltd.",
        invoiceNumber: "SEED-BPOS-001",
        date: "2026-10-20",
        total: "17000.00",
        flags: [],
      },
      {
        id: DOCUMENT_IDS.missingInvoice,
        vendorId: vendor1,
        status: "needs_review",
        vendorName: "Northstar Digital Solutions",
        invoiceNumber: null,
        date: "2026-10-21",
        total: "28750.00",
        flags: ["MISSING_INVOICE_NUMBER"],
      },
      {
        id: DOCUMENT_IDS.duplicate,
        vendorId: vendor2,
        status: "needs_review",
        vendorName: "Greenfield Packaging Works",
        invoiceNumber: "SEED-GPW-001",
        date: "2026-10-22",
        total: "6375.00",
        flags: ["DUPLICATE_INVOICE"],
      },
      {
        id: DOCUMENT_IDS.approved,
        vendorId: vendor1,
        status: "approved",
        vendorName: "BluePeak Office Supplies Pvt. Ltd.",
        invoiceNumber: "SEED-BPOS-002",
        date: "2026-10-23",
        total: "12500.00",
        flags: [],
        reviewedBy: reviewer,
        reviewedAt: "2026-10-24T10:00:00Z",
      },
      {
        id: DOCUMENT_IDS.rejected,
        vendorId: vendor2,
        status: "rejected",
        vendorName: "Greenfield Packaging Works",
        invoiceNumber: "SEED-GPW-002",
        date: "2026-10-24",
        total: "9000.00",
        flags: [],
        reviewedBy: reviewer,
        reviewedAt: "2026-10-25T10:00:00Z",
        rejectionReason:
          "Invoice details do not match the supporting information.",
      },
      {
        id: DOCUMENT_IDS.paid,
        vendorId: vendor1,
        status: "paid",
        vendorName: "Northstar Digital Solutions",
        invoiceNumber: "SEED-NDS-001",
        date: "2026-10-25",
        total: "22000.00",
        flags: [],
        reviewedBy: reviewer,
        reviewedAt: "2026-10-26T10:00:00Z",
        paidAt: "2026-10-27T10:00:00Z",
      },
    ];

    for (const doc of documents) {
      const rawText = [
        `Vendor: ${doc.vendorName}`,
        `Invoice Number: ${doc.invoiceNumber || ""}`,
        `Date: ${doc.date}`,
        `Total: ${doc.total}`,
      ].join("\n");

      await client.query(
        `INSERT INTO documents (
                    id, vendor_id, status, source_type, raw_text,
                    vendor_name, invoice_number, invoice_date, total,
                    currency, flags, reviewed_by, reviewed_at,
                    rejection_reason, paid_at
                )
                VALUES (
                    $1, $2, $3, 'text', $4,
                    $5, $6, $7, $8,
                    'INR', $9, $10, $11,
                    $12, $13
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    vendor_id = EXCLUDED.vendor_id,
                    status = EXCLUDED.status,
                    raw_text = EXCLUDED.raw_text,
                    vendor_name = EXCLUDED.vendor_name,
                    invoice_number = EXCLUDED.invoice_number,
                    invoice_date = EXCLUDED.invoice_date,
                    total = EXCLUDED.total,
                    flags = EXCLUDED.flags,
                    reviewed_by = EXCLUDED.reviewed_by,
                    reviewed_at = EXCLUDED.reviewed_at,
                    rejection_reason = EXCLUDED.rejection_reason,
                    paid_at = EXCLUDED.paid_at,
                    updated_at = NOW()`,
        [
          doc.id,
          doc.vendorId,
          doc.status,
          rawText,
          doc.vendorName,
          doc.invoiceNumber,
          doc.date,
          doc.total,
          JSON.stringify(doc.flags),
          doc.reviewedBy || null,
          doc.reviewedAt || null,
          doc.rejectionReason || null,
          doc.paidAt || null,
        ],
      );
    }

    console.log("Creating sample payment event...");

    await client.query(
      `INSERT INTO payment_events (
                event_id, document_id, payload, result
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (event_id) DO NOTHING`,
      [
        "SEED-PAYMENT-EVENT-001",
        DOCUMENT_IDS.paid,
        JSON.stringify({
          eventId: "SEED-PAYMENT-EVENT-001",
          documentId: DOCUMENT_IDS.paid,
          amount: "22000.00",
        }),
        "processed",
      ],
    );

    await client.query("COMMIT");

    console.log("\nSeed completed successfully.");
    console.log("Login credentials for all four accounts:");
    console.log(`Password: ${SEED_PASSWORD}`);

    for (const user of USERS) {
      console.log(`${user.role}: ${user.email}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
