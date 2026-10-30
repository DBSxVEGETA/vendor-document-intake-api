const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = ["application/pdf", "text/plain"];

    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error("Only PDF and TXT files are allowed");
      error.statusCode = 415;
      return callback(error);
    }

    callback(null, true);
  },
});

module.exports = upload;
