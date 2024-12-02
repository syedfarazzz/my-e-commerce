const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

router.route("/login").post(authController.loginUser);
router.route("/register").post(authController.registerUser);
router.route("/confirmed").post(authController.confirmEmail);
router.route("/resend").post(authController.resendOTP);
router.route("/forget").post(authController.forgetPassword);
router.route("/reset").post(authController.resetPassword);
router.route("/change").post(authenticate, authController.changePassword);

router.route("/signup").post(authController.signUpWithGmail);
module.exports = router;
