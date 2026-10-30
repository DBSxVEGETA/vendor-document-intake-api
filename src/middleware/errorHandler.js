function errorHandler(err, req, res, next) {
  console.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Handle Multer file-size errors.
  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    message = "File size exceeds the 5 MB limit";
  }

  // Handle unexpected Multer errors.
  if (err.name === "MulterError" && statusCode === 500) {
    statusCode = 400;
    message = "File upload failed";
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error" : message,
  });
}

module.exports = errorHandler;
