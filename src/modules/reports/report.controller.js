const reportService = require("./report.service");

async function getVendorMonthlyTotals(req, res, next) {
  try {
    const reports = await reportService.getVendorMonthlyTotals(
      req.user,
      req.query,
    );

    return res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getVendorMonthlyTotals };
