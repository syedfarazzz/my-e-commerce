const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const { authenticate } = require("../middlewares/authMiddleware");
const { ROLES } = require("../constants/index");
const { checkRole } = require("../middlewares/roleRestrictionMiddleware");

const router = express.Router();

router.route("/").get(authenticate, checkRole([ROLES.admin]), dashboardController.dashboardStats);
router.route("/graph").get(authenticate, checkRole([ROLES.admin]), dashboardController.fetchRevenue);


module.exports = router;
