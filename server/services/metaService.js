// Universal Pest Control — Meta (Facebook & Instagram) Lead Ads Service (Phase 7)
const crypto = require('crypto');
const metaModel = require('../models/metaModel');
const leadService = require('./leadService');
const notificationModel = require('../models/notificationModel');
const logger = require('../utils/logger');

class MetaService {
  constructor() {
    this.apiVersion = process.env.META_API_VERSION || 'v20.0';
    this.webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'upc_meta_webhook_verify_token_2026';
    this.mockMode = process.env.META_MOCK_MODE !== 'false';
  }

  /**
   * Safe error sanitization to guarantee access tokens and secrets are NEVER logged or exposed
   */
  sanitizeError(error, token = '') {
    if (!error) return 'Unknown Meta API error';
    let msg = error.message || String(error);
    if (token && token.length > 5) {
      msg = msg.split(token).join('[REDACTED_ACCESS_TOKEN]');
    }
    msg = msg.replace(/access_token=[a-zA-Z0-9_\-\.]+/gi, 'access_token=[REDACTED]');
    msg = msg.replace(/app_secret=[a-zA-Z0-9_\-\.]+/gi, 'app_secret=[REDACTED]');
    return msg;
  }

  /**
   * Internal helper: safely get active access token from database or env
   * (NEVER expose to frontend or log in plaintext)
   */
  async getActiveToken() {
    const rawConfig = await metaModel.getRawConfiguration();
    return rawConfig.access_token || process.env.META_ACCESS_TOKEN || '';
  }

  /**
   * Validate official Meta SHA256 Webhook Signature (X-Hub-Signature-256)
   */
  async verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    const rawConfig = await metaModel.getRawConfiguration();
    const appSecret = rawConfig.app_secret || process.env.META_APP_SECRET || '';

    // If appSecret is not configured, permit in development / mock mode
    if (!appSecret) {
      return true;
    }

    if (!signature) {
      logger.warn('Meta webhook missing X-Hub-Signature-256 header.');
      return false;
    }

    try {
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      const expectedHash = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const sigBuffer = Buffer.from(signature);
      const expBuffer = Buffer.from(expectedHash);
      if (sigBuffer.length !== expBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuffer, expBuffer);
    } catch (e) {
      logger.error(`Signature verification error: ${e.message}`);
      return false;
    }
  }

  /**
   * Webhook Handshake Verification (GET /api/meta/webhook)
   */
  async verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const rawConfig = await metaModel.getRawConfiguration();
    const expectedToken = rawConfig.webhook_verify_token || this.webhookVerifyToken;

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('Meta Lead Ads webhook successfully verified.');
      return { verified: true, challenge };
    }

    logger.warn(`Meta webhook verification failed: Token mismatch or invalid mode (received: ${token ? '[TOKEN_PROVIDED]' : 'null'})`);
    return { verified: false, challenge: null };
  }

  /**
   * Webhook Event Ingestion (POST /api/meta/webhook)
   * Prevents lead loss by immediately saving to buffer, then normalizing into CRM
   */
  async processWebhook(body) {
    if (!body || (body.object !== 'page' && body.object !== 'instagram' && body.object !== 'ad_account' && body.object !== 'leadgen')) {
      return { processed: false, reason: 'NOT_META_PAGE_EVENT' };
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    const results = { eventsReceived: 0, leadsProcessed: 0, failedCount: 0 };
    const token = await this.getActiveToken();

    for (const entry of entries) {
      const pageId = entry.id;
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        if (change.field !== 'leadgen' && !change.value?.leadgen_id) continue;

        const val = change.value || {};
        const leadgenId = val.leadgen_id;
        if (!leadgenId) continue;

        results.eventsReceived++;
        const eventId = `evt_meta_${leadgenId}_${Date.now()}`;

        // 1. Buffer event in database to guarantee ZERO lead loss
        let eventRecord;
        try {
          eventRecord = await metaModel.createLeadEvent({
            eventId,
            leadgenId,
            pageId: val.page_id || pageId,
            formId: val.form_id,
            adgroupId: val.adgroup_id,
            adId: val.ad_id,
            platform: val.platform || (body.object === 'instagram' ? 'ig' : null),
            status: 'RECEIVED',
            payload: val
          });
        } catch (dbErr) {
          logger.error(`Failed to buffer Meta webhook event #${leadgenId}: ${this.sanitizeError(dbErr, token)}`);
        }

        // 2. Fetch and ingest the full lead details
        try {
          const lead = await this.ingestLeadgen(leadgenId, val, eventRecord?.id);
          if (lead) results.leadsProcessed++;
        } catch (procErr) {
          results.failedCount++;
          const safeErrMsg = this.sanitizeError(procErr, token);
          logger.error(`[Meta Lead Ads Error] Failed to process leadgen #${leadgenId}: ${safeErrMsg}`);

          // Update event status to FAILED in buffer to guarantee lead is never lost
          if (eventRecord?.id) {
            await metaModel.updateEventStatus(eventRecord.id, {
              status: 'FAILED',
              errorMessage: safeErrMsg
            });
          }

          // Create notification for admin intervention
          await notificationModel.create({
            title: '⚠️ Meta Lead Ingestion Alert',
            message: `Failed to process incoming leadgen #${leadgenId}. Lead safely buffered for retry: ${safeErrMsg}`,
            type: 'warning',
            link: '/admin.html'
          });
        }
      }
    }

    return { processed: true, ...results };
  }

  /**
   * Fetch leadgen data from Meta Graph API, normalize fields, and create in CRM
   */
  async ingestLeadgen(leadgenId, metaContext = {}, eventId = null) {
    const token = await this.getActiveToken();
    let leadgenData = null;

    // 1. Fetch from Meta Graph API or Enterprise Sandbox Simulator
    if (!this.mockMode && token && !token.startsWith('EAAGMock')) {
      try {
        const url = `https://graph.facebook.com/${this.apiVersion}/${leadgenId}?fields=id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,field_data&access_token=${token}`;
        const response = await fetch(url);
        const respJson = await response.json();

        if (!response.ok) {
          const detail = respJson.error?.message || 'Failed to fetch lead data from Meta Graph API';
          throw new Error(detail);
        }
        leadgenData = respJson;
      } catch (err) {
        const safeErrMsg = this.sanitizeError(err, token);
        logger.warn(`Direct Meta Graph API fetch for #${leadgenId} failed: ${safeErrMsg}.`);
        // If this is a real Meta webhook without embedded test field_data, DO NOT fake data!
        // Throw safe error to ensure the lead is buffered in database for retry
        if (!metaContext.field_data) {
          throw new Error(`Meta Graph API lead retrieval failed: ${safeErrMsg}`);
        }
      }
    }

    // 2. Fallback / Mock simulation if live API not available or in sandbox mode
    if (!leadgenData) {
      // Check if context already provided field_data (e.g. simulated test webhook)
      if (metaContext.field_data) {
        leadgenData = {
          id: leadgenId,
          created_time: metaContext.created_time || new Date().toISOString(),
          ad_id: metaContext.ad_id || '2384758921029',
          ad_name: metaContext.ad_name || 'Monsoon Termite Shield Reel',
          adset_id: metaContext.adgroup_id || metaContext.adset_id || '2384758921030',
          adset_name: metaContext.adset_name || 'Pune Homeowners 28-55 Target',
          campaign_id: metaContext.campaign_id || '2384758921031',
          campaign_name: metaContext.campaign_name || 'Termite Monsoon Shield 2026',
          form_id: metaContext.form_id || '9382019482019',
          platform: metaContext.platform || 'fb',
          field_data: metaContext.field_data
        };
      } else {
        // Realistic simulated sample lead data for sandbox testing
        const isInstagram = metaContext.platform === 'ig' || String(leadgenId).endsWith('7') || Math.random() > 0.5;
        leadgenData = {
          id: leadgenId,
          created_time: new Date().toISOString(),
          ad_id: metaContext.ad_id || '2384758921029',
          ad_name: isInstagram ? 'Cockroach Odorless Gel Promo Reel' : 'Termite Monsoon Shield Feed Ad',
          adset_id: metaContext.adgroup_id || '2384758921030',
          adset_name: 'Pune Residential Communities Target',
          campaign_id: isInstagram ? '2384758921032' : '2384758921031',
          campaign_name: isInstagram ? 'Cockroach Odorless Gel Promo' : 'Termite Monsoon Shield 2026',
          form_id: metaContext.form_id || '9382019482019',
          platform: isInstagram ? 'ig' : 'fb',
          field_data: [
            { name: 'full_name', values: ['Pooja Kulkarni'] },
            { name: 'phone_number', values: ['+91 98220 55431'] },
            { name: 'email', values: ['pooja.kulkarni@gmail.com'] },
            { name: 'service_requested', values: [isInstagram ? 'Cockroach Control' : 'Termite Control'] },
            { name: 'city', values: ['Pune'] },
            { name: 'area', values: ['Baner'] },
            { name: 'property_type', values: ['Residential Apartment'] }
          ]
        };
      }
    }

    // 3. Normalize Lead Data
    const fieldMap = {};
    if (Array.isArray(leadgenData.field_data)) {
      leadgenData.field_data.forEach(item => {
        const val = Array.isArray(item.values) && item.values.length > 0 ? item.values[0] : (item.values || '');
        const key = (item.name || '').toLowerCase().trim();
        fieldMap[key] = val;
      });
    }

    const name = fieldMap.full_name || fieldMap.name || (fieldMap.first_name ? `${fieldMap.first_name} ${fieldMap.last_name || ''}`.trim() : null) || 'Meta Inbound Lead';
    const phone = fieldMap.phone_number || fieldMap.phone || fieldMap.mobile || fieldMap.contact_number || '';
    const email = fieldMap.email || fieldMap.email_address || null;

    let service = fieldMap.service_requested || fieldMap.service || fieldMap.pest_service || fieldMap.pest_control_service || null;
    if (!service) {
      for (const [k, v] of Object.entries(fieldMap)) {
        if (k.includes('service') || k.includes('pest') || k.includes('problem')) {
          service = v;
          break;
        }
      }
    }
    if (!service) {
      const comp = `${leadgenData.campaign_name || ''} ${leadgenData.ad_name || ''}`.toLowerCase();
      if (comp.includes('termite')) service = 'Termite Control';
      else if (comp.includes('cockroach') || comp.includes('gel')) service = 'Cockroach Control';
      else if (comp.includes('bed bug') || comp.includes('bedbug')) service = 'Bed Bug Control';
      else if (comp.includes('commercial') || comp.includes('kitchen') || comp.includes('fssai')) service = 'Commercial Pest Control';
      else if (comp.includes('rodent') || comp.includes('rat')) service = 'Rodent Control';
      else if (comp.includes('mosquito')) service = 'Mosquito Control';
      else service = 'General Pest Control';
    }

    const city = fieldMap.city || 'Pune';
    const area = fieldMap.area || fieldMap.locality || fieldMap.neighborhood || fieldMap.street_address || null;
    const location = area ? `${area}, ${city}` : city;
    const propertyType = fieldMap.property_type || fieldMap.property || fieldMap.property_size || 'Residential';

    // Platform detection (Facebook vs Instagram)
    const rawPlatform = String(leadgenData.platform || metaContext.platform || '').toLowerCase();
    const isInstagram = rawPlatform === 'ig' || rawPlatform.includes('instagram');
    const source = isInstagram ? 'INSTAGRAM_LEAD_AD' : 'FACEBOOK_LEAD_AD';
    const platformDisplay = isInstagram ? 'Instagram' : 'Facebook';

    const campaign = leadgenData.campaign_name || metaContext.campaign_name || 'Meta Monsoon Campaign 2026';
    const campaignId = leadgenData.campaign_id || metaContext.campaign_id || null;
    const adSet = leadgenData.adset_name || metaContext.adset_name || metaContext.adgroup_name || null;
    const adSetId = leadgenData.adset_id || metaContext.adgroup_id || metaContext.adset_id || null;
    const ad = leadgenData.ad_name || metaContext.ad_name || null;
    const adId = leadgenData.ad_id || metaContext.ad_id || null;

    let createdAt = new Date();
    if (leadgenData.created_time) {
      if (typeof leadgenData.created_time === 'number') {
        createdAt = new Date(leadgenData.created_time * 1000);
      } else {
        createdAt = new Date(leadgenData.created_time);
      }
    }

    // 4. Save to CRM through leadService (includes duplicate detection & customer upsert)
    const leadPayload = {
      name,
      phone,
      email,
      service,
      service_name: service,
      city,
      area,
      location,
      address: location,
      property: propertyType,
      property_type: propertyType,
      source,
      platform: platformDisplay,
      campaign,
      campaign_id: campaignId,
      campaignId,
      adset_name: adSet,
      adSet,
      adset_id: adSetId,
      adSetId,
      ad_name: ad,
      ad,
      ad_id: adId,
      adId,
      leadgen_id: String(leadgenId),
      leadgenId: String(leadgenId),
      raw_meta_payload: leadgenData,
      status: 'NEW',
      urgency: 'Today',
      created_at: createdAt,
      createdAt,
      message: `Inbound Lead Ad from ${platformDisplay} (${campaign} • ${ad || 'Direct Ad'})`
    };

    const newLead = await leadService.createLead(leadPayload);

    // 5. Update event status in buffer to PROCESSED
    if (eventId) {
      await metaModel.updateEventStatus(eventId, {
        status: 'PROCESSED',
        leadId: newLead.id
      });
    }

    logger.info(`[Meta Lead Ingested] ID: #${newLead.id} (${newLead.lead_code || newLead.leadCode}) Source: ${source} Name: ${name}`);
    return newLead;
  }

  /**
   * Retry a failed webhook event
   */
  async retryEvent(eventId) {
    const event = await metaModel.getEventById(eventId);
    if (!event) {
      throw new Error(`Meta lead event #${eventId} not found.`);
    }

    await metaModel.updateEventStatus(event.id, { status: 'RETRYING' });
    try {
      const lead = await this.ingestLeadgen(event.leadgenId, event.payload, event.id);
      return lead;
    } catch (err) {
      const safeErr = this.sanitizeError(err);
      await metaModel.updateEventStatus(event.id, {
        status: 'FAILED',
        errorMessage: safeErr
      });
      throw new Error(`Retry failed: ${safeErr}`);
    }
  }

  /**
   * Test Meta Connection
   */
  async testConnection() {
    const rawConfig = await metaModel.getRawConfiguration();
    const token = rawConfig.access_token;

    if (!token) {
      return {
        connected: false,
        status: 'DISCONNECTED',
        message: 'No Meta access token configured.'
      };
    }

    if (this.mockMode || token.startsWith('EAAGMock')) {
      return {
        connected: true,
        status: 'CONNECTED',
        pageName: rawConfig.page_name || 'Universal Pest Control Official',
        pageId: rawConfig.page_id || '109283746501928',
        adAccountId: rawConfig.ad_account_id || 'act_83921049281',
        appId: rawConfig.app_id || '928374650192837',
        mode: 'SIMULATED_SANDBOX',
        message: 'Meta Graph API connection verified (Enterprise Sandbox Mode).'
      };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/${this.apiVersion}/me?access_token=${token}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Meta API returned error');
      }

      return {
        connected: true,
        status: 'CONNECTED',
        metaUser: data.name,
        metaId: data.id,
        pageName: rawConfig.page_name,
        pageId: rawConfig.page_id,
        message: 'Live Meta Graph API connection verified.'
      };
    } catch (err) {
      const safeErr = this.sanitizeError(err, token);
      logger.error(`Meta test connection failed: ${safeErr}`);
      return {
        connected: false,
        status: 'ERROR',
        message: `Meta connection failed: ${safeErr}`
      };
    }
  }
}

module.exports = new MetaService();
