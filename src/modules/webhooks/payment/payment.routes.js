const express = require("express");
const paymentController = require("./payment.controller");

const router = express.Router();

router.post("/", paymentController.handlePaymentWebhook);

module.exports = router;
