const paymentService = require("./payment.service");

async function handlePaymentWebhook(req, res, next) {
  try {
    const signature = req.headers["x-signature"];

    const isValid = paymentService.verifySignature(req.rawBody, signature);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const result = await paymentService.processPaymentEvent(req.body);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handlePaymentWebhook,
};
