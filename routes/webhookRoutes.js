const express = require("express");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), orderController.stripeWebhookPaymentIntent);
router.post('/cli', express.raw({ type: 'application/json' }), orderController.webhookCli);

module.exports = router;
