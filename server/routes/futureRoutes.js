// Universal Pest Control — Future Integration Stubs
// Prepared architecture for Meta Ads, WhatsApp Business, Campaigns, and Advanced Analytics
const express = require('express');
const { apiError } = require('../utils/response');
const { authenticateToken } = require('../middleware/auth');

function createFutureRouter(moduleName) {
  const router = express.Router();
  router.use(authenticateToken);

  router.use((req, res) => {
    return apiError(
      res,
      `${moduleName} integration API is reserved for Phase 2 implementation. Endpoint ${req.method} ${req.originalUrl} will be activated once credentials are configured.`,
      501,
      {
        module: moduleName,
        status: 'PENDING_INTEGRATION_PHASE'
      }
    );
  });

  return router;
}

module.exports = {
  metaRouter: createFutureRouter('Meta Ads & Webhooks'),
  whatsappRouter: createFutureRouter('WhatsApp Cloud API'),
  campaignsRouter: createFutureRouter('Campaign Performance Studio'),
  analyticsRouter: createFutureRouter('Advanced Attribution & ROI')
};
