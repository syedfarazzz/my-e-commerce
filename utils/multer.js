const multer = require("multer");
const path = require("path");

// Memory storage for handling file uploads in memory
const storage = multer.memoryStorage();

// Check file Type
function checkImageFileType(file, cb) {
  // Allowed ext
  const fileTypes = /jpeg|jpg|png|gif|webp/;
  // Check ext
  const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimeType = fileTypes.test(file.mimetype);

  if (mimeType && extName) {
    return cb(null, true);
  } else {
    cb("Error: Images Only !!!");
  }
}

const uploadMultiple = multer({
  storage: storage,
  // limits: { fileSize: 20000000 },
  fileFilter: function (req, file, cb) {
    checkImageFileType(file, cb);
  }
}).array("image", 12);


// File filter function for CSV files
function checkCSVFileType(file, cb) {
  // Define allowed file extensions (CSV, XLS, XLSX)
  const allowedExtensions = ['.csv', '.xls', '.xlsx'];

  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check if the file extension is valid
  if (allowedExtensions.includes(fileExtension)) {
    // Handle MIME types for CSV, Excel 97-2003 (.xls), and Excel 2007+ (.xlsx)
    const validMIMETypes = [
      'text/csv',
      'application/vnd.ms-excel', // For .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // For .xlsx
    ];

    if (validMIMETypes.includes(file.mimetype)) {
      return cb(null, true);
    } else {
      return cb("Error: Invalid MIME type. Only CSV or Excel files are allowed.");
    }
  } else {
    return cb("Error: Invalid file extension. Only .csv, .xls, or .xlsx files are allowed.");
  }
}


// Multer setup for CSV uploads
const uploadCSV = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    checkCSVFileType(file, cb);
  },
}).single("file");  // "file" is the form-data key for the uploaded CSV


/*
const upload = multer({
  storage: multer.memoryStorage(),
  // limits: { fileSize: 20000000 },
  fileFilter: async function (req, file, cb) {
    checkFileType(file, cb);
  }
}).single("image");
*/

/*
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1000000 },
  fileFilter: async function (req, file, cb) {
    console.log("a");
    checkExcelFileType(file, cb);
  }
}).single("file");

// Check file type to validate if it's an Excel file
function checkExcelFileType(file, cb) {
  // Define allowed file extensions (in this case, only .xlsx)
  const allowedExtensions = ['.xlsx'];

  // Get the file extension of the uploaded file
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check if the file extension is valid
  if (allowedExtensions.includes(fileExtension)) {
    // Check if the MIME type also indicates an Excel file
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Both file extension and MIME type match the expected Excel format
      return cb(null, true);
    } else {
      // MIME type does not match the expected Excel format
      return cb("Error: Invalid MIME type. Only Excel files (.xlsx) are allowed.");
    }
  } else {
    // File extension is not valid for Excel files
    return cb("Error: Invalid file extension. Only .xlsx files are allowed.");
  }
}
*/

/*
//For Zip Files
const uploadZip = multer({
  storage: multer.memoryStorage(),
  fileFilter: async function (req, file, cb) {
  checkZipFileType(file, cb);
  }
}).single("zip");

// // Check file Type
function checkZipFileType(file, cb) {
  // Allowed ext
  const fileTypes = /zip|rar|/;
  // Check ext
  const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimeType = fileTypes.test(file.mimetype);

  if (mimeType && extName) {
    return cb(null, true);
  } else {
    cb("Error: Compressed Folder Only !!!");
  }
}
*/

module.exports = { uploadMultiple, uploadCSV };
