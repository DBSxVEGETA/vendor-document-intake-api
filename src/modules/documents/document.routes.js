const express = require("express");

const documentController = require("./document.controller");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");
const upload = require("../../middleware/upload");

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("vendor"),
  upload.single("document"),
  documentController.uploadDocument,
);

// List documents: vendors, reviewers and admins.
router.get(
  "/",
  authenticate,
  authorize("vendor", "reviewer", "admin"),
  documentController.getDocuments,
);

// Get a single document.
router.get(
  "/:id",
  authenticate,
  authorize("vendor", "reviewer", "admin"),
  documentController.getDocumentById,
);

router.patch(
  "/:id/approve",
  authenticate,
  authorize("reviewer", "admin"),
  documentController.approveDocument,
);

router.patch(
  "/:id/reject",
  authenticate,
  authorize("reviewer", "admin"),
  documentController.rejectDocument,
);

module.exports = router;
