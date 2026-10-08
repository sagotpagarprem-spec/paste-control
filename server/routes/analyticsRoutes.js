// Universal Pest Control — Analytics Routes (Phase 10)
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// Public tracking endpoint for website visitors & UTM attribution
// POST /api/analytics/track
router.post('/track', analyticsController.trackPageView);

// Admin Analytics Overview (Protected)
// GET /api/analytics/overview
router.get('/overview', authenticateToken, requirePermission('analytics:read'), analyticsController.getOverview);

module.exports = router;
