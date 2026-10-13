// Universal Pest Control — Meta Lead Ads Controller (Phase 7)
const metaService = require('../services/metaService');
const metaModel = require('../models/metaModel');
const { apiSuccess, apiError } = require('../utils/response');

const metaController = {
  /**
   * Webhook Verification Endpoint (Meta Graph API Handshake)
   * GET /api/meta/webhook
   */
  async getWebhook(req, res) {
    const { verified, challenge } = await metaService.verifyWebhook(req.query);
    if (verified) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification token mismatch or invalid mode.');
  },

  /**
   * Public Meta Pixel Configuration Endpoint
   * GET /api/meta/pixel-config
   */
  async getPixelConfig(req, res, next) {
    try {
      const config = await metaModel.getSafeConfiguration();
      const pixelId = config.pixelId || process.env.META_PIXEL_ID || null;
      return apiSuccess(res, {
        pixelId,
        enabled: Boolean(pixelId)
      }, 'Meta Pixel configuration.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Webhook Ingestion Endpoint (Meta Leadgen Event Notifications)
   * POST /api/meta/webhook
   */
  async postWebhook(req, res) {
    try {
      const isValid = await metaService.verifySignature(req);
      if (!isValid) {
        return res.status(401).json({ status: 'INVALID_SIGNATURE', message: 'Signature verification failed.' });
      }
      const result = await metaService.processWebhook(req.body);
      return res.status(200).json({ status: 'EVENT_RECEIVED', ...result });
    } catch (error) {
      return res.status(500).json({ status: 'SERVER_ERROR', message: error.message });
    }
  },

  /**
   * Get Meta Connection Status & Details
   * GET /api/meta/connection
   * (NEVER exposes access tokens to frontend)
   */
  async getConnection(req, res, next) {
    try {
      const config = await metaModel.getSafeConfiguration();
      return apiSuccess(res, config, 'Meta connection details retrieved.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Configure / Connect Meta Business Account
   * POST /api/meta/connection
   */
  async updateConnection(req, res, next) {
    try {
      const updated = await metaModel.updateConfiguration(req.body);
      return apiSuccess(res, updated, 'Meta Business connection saved successfully.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Test Meta Graph API Connectivity
   * POST /api/meta/test-connection
   */
  async testConnection(req, res, next) {
    try {
      const result = await metaService.testConnection();
      return apiSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get Active Meta Lead Ad Campaigns & ROI Performance
   * GET /api/meta/campaigns
   */
  async getCampaigns(req, res, next) {
    try {
      const campaigns = await metaModel.getCampaigns();
      return apiSuccess(res, campaigns, 'Meta campaigns retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get Webhook Event Audit Log
   * GET /api/meta/events
   */
  async getEvents(req, res, next) {
    try {
      const { limit, status } = req.query;
      const events = await metaModel.getLeadEvents({ limit, status });
      return apiSuccess(res, events, 'Meta webhook events retrieved.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retry a Failed Webhook Event
   * POST /api/meta/events/:id/retry
   */
  async retryEvent(req, res, next) {
    try {
      const { id } = req.params;
      const lead = await metaService.retryEvent(id);
      return apiSuccess(res, lead, 'Webhook event retried and processed successfully.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Simulate a Facebook/Instagram Lead Ad submission (Admin Testing)
   * POST /api/meta/simulate-lead
   */
  async simulateLead(req, res, next) {
    try {
      const platform = req.body.platform || 'fb';
      const name = req.body.name || req.body.fullName || 'Pooja Kulkarni';
      const phone = req.body.phone || '+91 98220 55431';
      const email = req.body.email || 'pooja.kulkarni@gmail.com';
      const service = req.body.service || 'Termite Control';
      const city = req.body.city || 'Pune';
      const area = req.body.area || 'Baner';
      const campaignName = req.body.campaignName || req.body.campaign || 'Termite Monsoon Shield 2026';
      const adName = req.body.adName || req.body.ad || 'Monsoon Termite Shield Reel';
      const adSetName = req.body.adSetName || req.body.adSet || 'Pune Residential Target 28-55';

      const leadgenId = `sim_lg_${Date.now()}`;
      const fakeContext = {
        platform,
        campaign_name: campaignName,
        adset_name: adSetName,
        ad_name: adName,
        field_data: [
          { name: 'full_name', values: [name] },
          { name: 'phone_number', values: [phone] },
          { name: 'email', values: [email] },
          { name: 'service_requested', values: [service] },
          { name: 'city', values: [city] },
          { name: 'area', values: [area] }
        ]
      };

      const eventRecord = await metaModel.createLeadEvent({
        eventId: `evt_sim_${leadgenId}`,
        leadgenId,
        platform,
        status: 'RECEIVED',
        payload: fakeContext
      });

      const lead = await metaService.ingestLeadgen(leadgenId, fakeContext, eventRecord.id);
      return apiSuccess(res, lead, `Simulated ${platform.toUpperCase()} Lead Ad ingested into CRM.`, 201);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = metaController;
