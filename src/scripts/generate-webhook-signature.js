require("dotenv").config();

const crypto = require("crypto");

const payload = {
  eventId: "PAYMENT-EVENT-001",
  documentId: process.argv[2],
  amount: "17000.00",
};

const rawBody = JSON.stringify(payload);

const signature = crypto
  .createHmac("sha256", process.env.WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

console.log("Request body:");
console.log(rawBody);
console.log("\nX-Signature:");
console.log(signature);
