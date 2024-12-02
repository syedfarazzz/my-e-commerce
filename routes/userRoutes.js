const express = require("express");
const userController = require("../controllers/userController");
const { authenticate } = require("../middlewares/authMiddleware");
const { ROLES } = require("../constants/index");
const { checkRole } = require("../middlewares/roleRestrictionMiddleware");
const { cacheMiddleware } = require("../middlewares/redisMiddleware");
const { generateFetchUsersKey, generateCurrentUserKey, generateFetchUserByIdKey } = require("../utils/cacheKeyGenerators");

const router = express.Router();

// Define cache duration (in seconds)
const CACHE_DURATION = 60 * 5; // 5 minutes

//Redis routes
router.route("/").post(authenticate, checkRole([ROLES.admin]), userController.fetchUsers);
router.route('/me').get(authenticate, userController.currentUser);

// Place the generic ':id' routes at the end
router.route('/:id').get(authenticate, checkRole([ROLES.admin]), userController.fetchUserById);
router.route('/:id').delete(authenticate, checkRole([ROLES.admin]), userController.deleteUser);
router.route('/:id').put(authenticate, checkRole([ROLES.admin, ROLES.customer]), userController.updateUser);
router.route('/recaptcha').post(userController.verifyRecaptcha);


// //Redis routes
// router.route("/").post(authenticate, checkRole([ROLES.admin]), cacheMiddleware(generateFetchUsersKey, CACHE_DURATION), userController.fetchUsers);
// router.route('/me').get(authenticate, cacheMiddleware(generateCurrentUserKey, CACHE_DURATION), userController.currentUser);

// // Place the generic ':id' routes at the end
// router.route('/:id').get(authenticate, checkRole([ROLES.admin]), cacheMiddleware(generateFetchUserByIdKey, CACHE_DURATION), userController.fetchUserById);
// router.route('/:id').delete(authenticate, checkRole([ROLES.admin]), userController.deleteUser);
// router.route('/:id').put(authenticate, checkRole([ROLES.admin, ROLES.customer]), userController.updateUser);

module.exports = router;
