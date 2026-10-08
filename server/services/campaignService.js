// Universal Pest Control — Meta Marketing API Campaign Service (Phase 8)
const campaignModel = require('../models/campaignModel');
const metaModel = require('../models/metaModel');
const logger = require('../utils/logger');

class CampaignService {
  constructor() {
    this.apiVersion = process.env.META_API_VERSION || 'v20.0';
    this.mockMode = process.env.META_MOCK_MODE !== 'false';
  }

  /**
   * Internal helper: safely get active access token
   * NEVER exposed to frontend or logged
   */
  async getActiveToken() {
    const raw = await metaModel.getRawConfiguration();
    return raw.access_token || process.env.META_ACCESS_TOKEN || '';
  }

  /**
   * Safe error message sanitization
   */
  sanitizeError(error, token = '') {
    if (!error) return 'Unknown error';
    let msg = error.message || String(error);
    if (token && token.length > 5) {
      msg = msg.split(token).join('[REDACTED_ACCESS_TOKEN]');
    }
    msg = msg.replace(/access_token=[a-zA-Z0-9_\-\.]+/gi, 'access_token=[REDACTED]');
    return msg;
  }

  /**
   * Advance campaign through official lifecycle workflow:
   * Draft → Review → Ready → Publish → Active → Paused → Completed
   */
  async transitionStatus(id, targetStatus) {
    const campaign = await campaignModel.getCampaignById(id);
    if (!campaign) {
      throw new Error(`Campaign #${id} not found.`);
    }

    const current = String(campaign.status).toUpperCase();
    let target = String(targetStatus).toUpperCase();
    if (target === 'PUBLISHED') target = 'PUBLISH';

    // Strict Workflow Progression check
    const allowedTransitions = {
      DRAFT: ['REVIEW', 'ARCHIVED'],
      REVIEW: ['READY', 'DRAFT', 'ARCHIVED'],
      READY: ['PUBLISH', 'DRAFT'],
      PUBLISH: ['ACTIVE', 'PAUSED'],
      ACTIVE: ['PAUSED', 'COMPLETED'],
      PAUSED: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
      COMPLETED: ['ACTIVE', 'ARCHIVED'],
      ARCHIVED: ['DRAFT']
    };

    if (allowedTransitions[current] && !allowedTransitions[current].includes(target)) {
      throw new Error(`Cannot transition campaign directly from ${current} to ${target}. Workflow: Draft → Review → Ready → Publish → Active → Paused → Completed.`);
    }

    // If publishing, attempt official Meta Marketing API call server-side
    let metaApiResult = null;
    if (target === 'PUBLISH' || target === 'ACTIVE') {
      const token = await this.getActiveToken();
      if (!this.mockMode && token && !token.startsWith('EAAGMock')) {
        try {
          const rawConfig = await metaModel.getRawConfiguration();
          const adAccountId = rawConfig.ad_account_id;
          if (adAccountId) {
            const url = `https://graph.facebook.com/${this.apiVersion}/${adAccountId}/campaigns`;
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: campaign.name,
                objective: campaign.objective,
                status: target === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                special_ad_categories: ['NONE']
              })
            });
            const data = await res.json();
            if (data.id) {
              await campaignModel.updateCampaign(campaign.id, { campaignId: data.id });
              metaApiResult = { success: true, metaCampaignId: data.id };
              logger.info(`Campaign #${campaign.id} published to Meta Marketing API: ${data.id}`);
            } else {
              const errMsg = this.sanitizeError(new Error(data.error?.message || 'Meta API returned error'), token);
              logger.warn(`Meta Marketing API publish rejected: ${errMsg}`);
              metaApiResult = { success: false, error: errMsg };
            }
          }
        } catch (err) {
          const errMsg = this.sanitizeError(err, token);
          logger.warn(`Meta Marketing API publish call failed: ${errMsg}`);
          metaApiResult = { success: false, error: errMsg };
        }
      }
    }

    const updated = await campaignModel.updateStatus(id, target);
    return {
      ...updated,
      metaApiResult
    };
  }

  /**
   * Synchronize performance metrics:
   * Spend, Impressions, Clicks, Leads, CPL, Conversions
   * Rule: NEVER display fake metrics. If API data is unavailable, clearly mark state.
   */
  async syncMetrics(id) {
    const campaign = await campaignModel.getCampaignById(id);
    if (!campaign) {
      throw new Error(`Campaign #${id} not found.`);
    }

    const token = await this.getActiveToken();
    let syncedMetrics = null;
    let apiStatus = 'UNAVAILABLE';

    if (!this.mockMode && token && !token.startsWith('EAAGMock') && campaign.campaignId && !campaign.campaignId.startsWith('cmp_')) {
      try {
        const url = `https://graph.facebook.com/${this.apiVersion}/${campaign.campaignId}/insights?fields=spend,impressions,clicks,actions&access_token=${token}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.data && data.data.length > 0) {
          const insight = data.data[0];
          const leadsAction = (insight.actions || []).find(a => a.action_type === 'lead');
          const leads = leadsAction ? Number(leadsAction.value) : 0;
          const spend = Number(insight.spend || 0);

          syncedMetrics = {
            spend,
            impressions: Number(insight.impressions || 0),
            clicks: Number(insight.clicks || 0),
            leads,
            cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : 0.00
          };
          apiStatus = 'LIVE_SYNCED';
        } else {
          apiStatus = 'NO_DATA_RETURNED';
        }
      } catch (err) {
        const safeErr = this.sanitizeError(err, token);
        logger.warn(`Could not sync live Meta insights: ${safeErr}`);
        apiStatus = 'API_ERROR';
      }
    }

    if (syncedMetrics) {
      const updated = await campaignModel.syncMetrics(id, syncedMetrics);
      return {
        campaign: updated,
        apiDataAvailable: true,
        apiStatus,
        message: 'Metrics successfully synchronized from Meta Insights.'
      };
    }

    // If API data is unavailable, clearly report unavailable state without faking
    return {
      campaign,
      apiDataAvailable: false,
      apiStatus,
      message: 'Live Meta Marketing API insights data unavailable for this campaign.'
    };
  }
}

module.exports = new CampaignService();
