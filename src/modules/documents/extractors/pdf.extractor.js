const pdfParse = require("pdf-parse");

async function extractPdfText(buffer) {
  try {
    const result = await pdfParse(buffer);

    if (!result.text || !result.text.trim()) {
      const error = new Error(
        "PDF contains no readable text. Scanned PDFs are not supported.",
      );
      error.statusCode = 422;
      throw error;
    }

    return result.text;
  } catch (error) {
    if (error.statusCode === 422) {
      throw error;
    }

    const extractionError = new Error("Unable to extract text from the PDF");
    extractionError.statusCode = 422;
    throw extractionError;
  }
}

module.exports = { extractPdfText };
