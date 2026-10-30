const express = require("express");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./modules/auth/auth.routes");
const testAuthRoutes = require("./routes/test-auth.routes");
const documentRoutes = require("./modules/documents/document.routes");
const errorHandler = require("./middleware/errorHandler");
const paymentRoutes = require("./modules/webhooks/payment/payment.routes");
const reportRoutes = require("./modules/reports/report.routes");

const app = express();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }),
);

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/test", testAuthRoutes);
app.use("/api/documents", documentRoutes);
app.use("/webhooks/payment", paymentRoutes);
app.use("/api/reports", reportRoutes);

app.use(errorHandler);

module.exports = app;
