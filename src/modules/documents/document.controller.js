const documentService = require("./document.service");
const { extractPdfText } = require("./extractors/pdf.extractor");
const { extractInvoiceData } = require("./extractors/mock.extractor");

async function uploadDocument(req, res, next) {
  try {
    let rawText;
    let sourceType;

    if (req.file) {
      sourceType = req.file.mimetype === "application/pdf" ? "pdf" : "text";

      if (sourceType === "pdf") {
        rawText = await extractPdfText(req.file.buffer);
      } else {
        rawText = req.file.buffer.toString("utf8");
      }
    } else if (typeof req.body.text === "string") {
      rawText = req.body.text;
      sourceType = "text";
    } else {
      return res.status(400).json({
        success: false,
        message: "Upload a PDF/TXT file or provide text in the request body",
      });
    }

    // Reject unreadable or empty content before saving.
    extractInvoiceData(rawText);

    const document = await documentService.processDocument({
      vendorId: req.user.id,
      rawText,
      sourceType,
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded and processed successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
}

async function getDocuments(req, res, next) {
  try {
    const result = await documentService.getDocuments(req.user, req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getDocumentById(req, res, next) {
  try {
    const document = await documentService.getDocumentById(
      req.params.id,
      req.user,
    );

    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
}

async function approveDocument(req, res, next) {
  try {
    const document = await documentService.approveDocument(
      req.params.id,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      message: "Document approved successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
}

async function rejectDocument(req, res, next) {
  try {
    const document = await documentService.rejectDocument(
      req.params.id,
      req.user.id,
      req.body.reason,
    );

    res.status(200).json({
      success: true,
      message: "Document rejected successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  approveDocument,
  rejectDocument,
};
