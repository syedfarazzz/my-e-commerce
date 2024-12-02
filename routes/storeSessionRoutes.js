// sessionRoutes.js

const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { viewSessions, logout, logoutAll } = require('../controllers/storeSessionController');

const router = express.Router();

// Pass userId as a route parameter
router.route('/active-sessions').get(authenticate, viewSessions);
router.route('/sessions_logout/:sessionId').delete(authenticate, logout);
router.route('/sessions_logout_all').delete(authenticate, logoutAll);

module.exports = router;
