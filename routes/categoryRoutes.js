const express = require("express");
const categoryController = require("../controllers/categoryController");
const { authenticate } = require("../middlewares/authMiddleware");
const { ROLES } = require("../constants/index");
const { checkRole } = require("../middlewares/roleRestrictionMiddleware");
const { cacheMiddleware } = require("../middlewares/redisMiddleware");
const { generateFetchCategoriesKey, generateFetchPublicCategoriesKey, generateFetchCategoryByIdKey } = require("../utils/cacheKeyGenerators");

const router = express.Router();

// Define cache duration (in seconds)
const CACHE_DURATION = 60 * 5; // 5 minutes

router.route("/").post(authenticate, checkRole([ROLES.admin, ROLES.customer]), categoryController.fetchCategories);
router.route("/public").post(categoryController.fetchPublicCategories);
router.route("/add").post(authenticate, checkRole([ROLES.admin]), categoryController.addCategory);
router.route('/disable/:id').put(authenticate, checkRole([ROLES.admin]), categoryController.disableCategory);

// Place the generic ':id' routes at the end
router.route('/:id').delete(authenticate, checkRole([ROLES.admin]), categoryController.deleteCategory);
router.route('/:id').put(authenticate, checkRole([ROLES.admin]), categoryController.editCategory);
router.route('/:id').get(categoryController.fetchCategoryById);

// router.route("/").post(authenticate, cacheMiddleware(generateFetchCategoriesKey, CACHE_DURATION), checkRole([ROLES.admin, ROLES.customer]), categoryController.fetchCategories);
// router.route("/public").post(cacheMiddleware(generateFetchPublicCategoriesKey, CACHE_DURATION), categoryController.fetchPublicCategories);
// router.route("/add").post(authenticate, checkRole([ROLES.admin]), categoryController.addCategory);
// router.route('/disable/:id').put(authenticate, checkRole([ROLES.admin]), categoryController.disableCategory);

// // Place the generic ':id' routes at the end
// router.route('/:id').delete(authenticate, checkRole([ROLES.admin]), categoryController.deleteCategory);
// router.route('/:id').put(authenticate, checkRole([ROLES.admin]), categoryController.editCategory);
// router.route('/:id').get(cacheMiddleware(generateFetchCategoryByIdKey, CACHE_DURATION), categoryController.fetchCategoryById);


module.exports = router;
