const express = require("express");
const orderController = require("../controllers/orderController");
const { authenticate } = require("../middlewares/authMiddleware");
const { ROLES } = require("../constants/index");
const { checkRole } = require("../middlewares/roleRestrictionMiddleware");

const router = express.Router();

router.route("/").post(authenticate, checkRole([ROLES.admin]), orderController.fetchOrders);
router.route("/add").post(orderController.addOrder);
// router.route("/paid").get(orderController.paidOrder);
// router.route("/cancel").get(orderController.cancelOrder);
router.route("/cancel").post(orderController.cancelIntent);

// Place the generic ':id' routes at the end
router.route('/:id').put(authenticate, checkRole([ROLES.admin]), orderController.editOrder);
router.route('/:id').get(authenticate, checkRole([ROLES.admin, ROLES.customer]), orderController.fetchOrderById);



module.exports = router;
