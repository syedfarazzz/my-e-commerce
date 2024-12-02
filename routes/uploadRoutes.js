const express = require('express');
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const { uploadImages } = require('../controllers/uploadController');
const { uploadMultiple } = require('../utils/multer');

router.route('/images').post( authenticate, uploadMultiple, uploadImages );

module.exports = router;
