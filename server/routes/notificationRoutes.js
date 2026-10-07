// Universal Pest Control — Notification Routes
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/notifications
router.get('/', notificationController.getNotifications);

// PUT /api/notifications/read-all
router.put('/read-all', notificationController.markAllRead);

module.exports = router;
