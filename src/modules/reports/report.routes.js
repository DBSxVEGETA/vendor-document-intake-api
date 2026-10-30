const express = require("express");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");
const reportController = require("./report.controller");

const router = express.Router();

router.get(
  "/vendor-monthly-totals",
  authenticate,
  authorize("vendor", "reviewer", "admin"),
  reportController.getVendorMonthlyTotals,
);

module.exports = router;
