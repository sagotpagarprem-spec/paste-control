// Universal Pest Control — Follow-up Routes
const express = require('express');
const router = express.Router();
const followupController = require('../controllers/followupController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// Protected Follow-up Management
router.use(authenticateToken);

// GET /api/followups
router.get('/', requirePermission('leads:read'), followupController.getFollowups);

// GET /api/followups/:id
router.get('/:id', requirePermission('leads:read'), followupController.getFollowupById);

// POST /api/followups
router.post('/', requirePermission('leads:manage'), followupController.createFollowup);

// PUT /api/followups/:id
router.put('/:id', requirePermission('leads:manage'), followupController.updateFollowup);

// DELETE /api/followups/:id
router.delete('/:id', requirePermission('leads:manage'), followupController.deleteFollowup);

module.exports = router;
