require("dotenv").config();

const pool = require("../config/database");
const { processDocument } = require("../modules/documents/document.service");

async function testDocumentService() {
  try {
    // Replace this with the ID of an existing vendor in your database.
    const vendorResult = await pool.query(
      `SELECT id FROM users WHERE role = 'vendor' LIMIT 1`,
    );

    if (vendorResult.rowCount === 0) {
      throw new Error("No vendor account found. Register a vendor first.");
    }

    const vendorId = vendorResult.rows[0].id;

    const sampleInvoice = `
Vendor: ABC Technologies
Invoice Number: INV-2026-TEST-001
Date: 2026-10-20
Total: 15000.50
`;

    const result = await processDocument({
      vendorId,
      rawText: sampleInvoice,
      sourceType: "text",
    });

    console.log("Document saved successfully:");
    console.log(result);
  } catch (error) {
    console.error("Document processing failed:", error.message);
  } finally {
    await pool.end();
  }
}

testDocumentService();
