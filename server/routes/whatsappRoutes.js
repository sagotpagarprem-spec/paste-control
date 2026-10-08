// Universal Pest Control — WhatsApp Business API Routes (Phase 6)
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// 1. Official Meta Webhook Endpoints (Public — Handshake & Event Ingestion)
// GET /api/whatsapp/webhook (Meta verification handshake)
router.get('/webhook', whatsappController.getWebhook);

// POST /api/whatsapp/webhook (Meta status updates & inbound customer messages)
router.post('/webhook', whatsappController.postWebhook);

// 2. Protected Admin WhatsApp Operations
// GET /api/whatsapp/conversations
router.get(
  '/conversations',
  authenticateToken,
  requirePermission('whatsapp:read'),
  whatsappController.getConversations
);

// GET /api/whatsapp/messages/:phone
router.get(
  '/messages/:phone',
  authenticateToken,
  requirePermission('whatsapp:read'),
  whatsappController.getMessages
);

// GET /api/whatsapp/templates
router.get(
  '/templates',
  authenticateToken,
  requirePermission('whatsapp:read'),
  whatsappController.getTemplates
);

// POST /api/whatsapp/send-template
router.post(
  '/send-template',
  authenticateToken,
  requirePermission('whatsapp:manage'),
  whatsappController.sendTemplate
);

// POST /api/whatsapp/send-message
router.post(
  '/send-message',
  authenticateToken,
  requirePermission('whatsapp:manage'),
  whatsappController.sendMessage
);

// PATCH /api/whatsapp/messages/:id/status
router.patch(
  '/messages/:id/status',
  authenticateToken,
  requirePermission('whatsapp:manage'),
  whatsappController.updateMessageStatus
);

module.exports = router;
