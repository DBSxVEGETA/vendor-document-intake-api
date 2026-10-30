const express = require("express");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./modules/auth/auth.routes");
const testAuthRoutes = require("./routes/test-auth.routes");
const documentRoutes = require("./modules/documents/document.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/test", testAuthRoutes);
app.use("/api/documents", documentRoutes);

app.use(errorHandler);

module.exports = app;
