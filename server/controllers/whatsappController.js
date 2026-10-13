// Universal Pest Control — WhatsApp Controller (Phase 6)
const whatsappService = require('../services/whatsappService');
const whatsappModel = require('../models/whatsappModel');
const { apiSuccess, apiError } = require('../utils/response');

const whatsappController = {
  /**
   * Webhook Verification Endpoint (Meta Cloud API Handshake)
   * GET /api/whatsapp/webhook
   */
  getWebhook(req, res) {
    const { verified, challenge } = whatsappService.verifyWebhook(req.query);
    if (verified) {
      // Meta specifies returning the raw challenge string with status 200
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification token mismatch or invalid mode.');
  },

  /**
   * Webhook Ingestion Endpoint (Meta Cloud API Notifications)
   * POST /api/whatsapp/webhook
   */
  async postWebhook(req, res, next) {
    try {
      const isValid = whatsappService.verifySignature(req);
      if (!isValid) {
        return res.status(401).json({ status: 'INVALID_SIGNATURE', message: 'Signature verification failed.' });
      }
      const result = await whatsappService.processWebhook(req.body);
      // Respond 200 to acknowledge receipt to Meta
      return res.status(200).json({ status: 'EVENT_RECEIVED', ...result });
    } catch (error) {
      // Return 500 retryable error so Meta will retry delivery
      return res.status(500).json({ status: 'SERVER_ERROR', message: error.message });
    }
  },

  /**
   * List all conversation threads with customer details
   * GET /api/whatsapp/conversations
   */
  async getConversations(req, res, next) {
    try {
      const { search, limit, offset } = req.query;
      const conversations = await whatsappModel.getConversations({ search, limit, offset });
      return apiSuccess(res, conversations, 'Conversations retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get full message history for a phone number
   * GET /api/whatsapp/messages/:phone
   */
  async getMessages(req, res, next) {
    try {
      const { phone } = req.params;
      const { limit, offset } = req.query;
      if (!phone) {
        return apiError(res, 'Phone number parameter is required.', 400);
      }

      const messages = await whatsappModel.getMessagesByPhone(phone, { limit, offset });
      return apiSuccess(res, messages, 'Message history retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * List all approved WhatsApp templates
   * GET /api/whatsapp/templates
   */
  async getTemplates(req, res, next) {
    try {
      const { category, status } = req.query;
      const templates = await whatsappModel.getTemplates({ category, status });
      return apiSuccess(res, templates, 'WhatsApp templates retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send an approved template message
   * POST /api/whatsapp/send-template
   */
  async sendTemplate(req, res, next) {
    try {
      const { to, templateName, language, parameters, components, customerId, leadId, bookingId } = req.body;
      if (!to || !templateName) {
        return apiError(res, 'Recipient phone ("to") and "templateName" are required.', 400);
      }

      const message = await whatsappService.sendTemplate({
        to,
        templateName,
        language: language || 'en',
        parameters: parameters || [],
        components: components || [],
        customerId,
        leadId,
        bookingId
      });

      return apiSuccess(res, message, `Template "${templateName}" dispatched successfully.`, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send a free-form customer service text message
   * POST /api/whatsapp/send-message
   */
  async sendMessage(req, res, next) {
    try {
      const { to, text, message, customerId, leadId, bookingId } = req.body;
      const content = text || message;
      if (!to || !content) {
        return apiError(res, 'Recipient phone ("to") and message text are required.', 400);
      }

      const dispatched = await whatsappService.sendTextMessage({
        to,
        text: content,
        customerId,
        leadId,
        bookingId
      });

      return apiSuccess(res, dispatched, 'WhatsApp message dispatched successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update message status (QUEUED, SENT, DELIVERED, READ, FAILED)
   * PATCH /api/whatsapp/messages/:id/status
   */
  async updateMessageStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, errorMessage } = req.body;
      if (!status) {
        return apiError(res, 'Status is required.', 400);
      }

      const validStatuses = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'];
      const normalized = String(status).toUpperCase();
      if (!validStatuses.includes(normalized)) {
        return apiError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 422);
      }

      const updated = await whatsappModel.updateMessageStatus(id, normalized, errorMessage);
      if (!updated) {
        return apiError(res, 'Message not found.', 404);
      }

      return apiSuccess(res, updated, `Message status updated to ${normalized}.`);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = whatsappController;
