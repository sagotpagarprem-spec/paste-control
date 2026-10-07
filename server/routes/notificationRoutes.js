// Universal Pest Control — Notification Routes
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/notifications
router.get('/', notificationController.getNotifications);

// POST /api/notifications
router.post('/', notificationController.createNotification);

// PUT /api/notifications/read-all
router.put('/read-all', notificationController.markAllRead);

// PUT /api/notifications/:id/read
router.put('/:id/read', notificationController.markRead);

module.exports = router;
