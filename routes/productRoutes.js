const express = require("express");
const productController = require("../controllers/productController");
const { authenticate } = require("../middlewares/authMiddleware");
const { ROLES } = require("../constants/index");
const { checkRole } = require("../middlewares/roleRestrictionMiddleware");
const { uploadCSV } = require('../utils/multer');

const router = express.Router();

router.route("/").post(authenticate, checkRole([ROLES.admin, ROLES.customer]), productController.fetchProducts);
router.route("/public").post(productController.fetchProductsPublic);
router.route("/add").post(authenticate, checkRole([ROLES.admin]), productController.addProduct);
// router.route('/excel').post(authenticate, checkRole([ROLES.admin]), uploadExcel, productController.addExcelFile);
router.route('/like/:id').put(authenticate, checkRole([ROLES.customer]), productController.likeProduct);
router.route('/save/:id').put(authenticate, checkRole([ROLES.customer]), productController.saveProduct);
router.route('/view/:id').put(authenticate, checkRole([ROLES.customer]), productController.viewProduct);
router.route('/ratings/:id').post(authenticate, checkRole([ROLES.customer]), productController.rateProduct);
router.route('/top').post(productController.topProducts);
router.route("/import").post(authenticate, checkRole([ROLES.admin]), uploadCSV, productController.addProductFromFile);
// router.route('/count').get(authenticate, checkRole([ROLES.admin]), productController.countProductsInfo);


// Place the generic ':id' routes at the end
router.route('/:id').delete(authenticate, checkRole([ROLES.admin]), productController.deleteProduct);
router.route('/:id').put(authenticate, checkRole([ROLES.admin]), productController.editProduct);
router.route('/:id').get(productController.fetchProductById);
router.route('/title/:title').get(productController.fetchProductByTitle);



module.exports = router;
