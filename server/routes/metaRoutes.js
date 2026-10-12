// Universal Pest Control — Meta Lead Ads API Routes (Phase 7)
const express = require('express');
const router = express.Router();
const metaController = require('../controllers/metaController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// 1. Official Meta Webhook & Public Configuration Endpoints
// GET /api/meta/webhook (Meta verification handshake)
router.get('/webhook', metaController.getWebhook);

// POST /api/meta/webhook (Meta Lead Ads webhook notifications)
router.post('/webhook', metaController.postWebhook);

// GET /api/meta/pixel-config (Public Meta Pixel tracking configuration)
router.get('/pixel-config', metaController.getPixelConfig);

// 2. Protected Admin Meta Operations
// GET /api/meta/connection
router.get(
  '/connection',
  authenticateToken,
  requirePermission('meta:read'),
  metaController.getConnection
);

// POST /api/meta/connection
router.post(
  '/connection',
  authenticateToken,
  requirePermission('meta:manage'),
  metaController.updateConnection
);

// POST /api/meta/test-connection
router.post(
  '/test-connection',
  authenticateToken,
  requirePermission('meta:read'),
  metaController.testConnection
);

// GET /api/meta/campaigns
router.get(
  '/campaigns',
  authenticateToken,
  requirePermission('meta:read'),
  metaController.getCampaigns
);

// GET /api/meta/events
router.get(
  '/events',
  authenticateToken,
  requirePermission('meta:read'),
  metaController.getEvents
);

// POST /api/meta/events/:id/retry
router.post(
  '/events/:id/retry',
  authenticateToken,
  requirePermission('meta:manage'),
  metaController.retryEvent
);

// POST /api/meta/simulate-lead
router.post(
  '/simulate-lead',
  authenticateToken,
  requirePermission('meta:manage'),
  metaController.simulateLead
);

module.exports = router;
