const pool = require("../../config/database");

async function getVendorMonthlyTotals(user, { from, to }) {
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

  if (!monthPattern.test(from || "") || !monthPattern.test(to || "")) {
    const error = new Error("from and to must use YYYY-MM format");
    error.statusCode = 400;
    throw error;
  }

  if (from > to) {
    const error = new Error("from cannot be later than to");
    error.statusCode = 400;
    throw error;
  }

  const isVendor = user.role === "vendor";

  const query = `
        SELECT
            d.vendor_id,
            u.email AS vendor_email,
            TO_CHAR(
                DATE_TRUNC('month', d.invoice_date),
                'YYYY-MM'
            ) AS month,
            COUNT(*) AS invoice_count,
            SUM(d.total) AS total_amount,
            d.currency
        FROM documents d
        JOIN users u ON u.id = d.vendor_id
        WHERE d.status IN ('approved', 'paid')
          AND d.invoice_date >= $1::date
          AND d.invoice_date < ($2::date + INTERVAL '1 month')
          ${isVendor ? "AND d.vendor_id = $3" : ""}
        GROUP BY
            d.vendor_id,
            u.email,
            DATE_TRUNC('month', d.invoice_date),
            d.currency
        ORDER BY month DESC, u.email ASC
    `;

  const params = isVendor
    ? [`${from}-01`, `${to}-01`, user.id]
    : [`${from}-01`, `${to}-01`];

  const result = await pool.query(query, params);

  return result.rows;
}

module.exports = { getVendorMonthlyTotals };
