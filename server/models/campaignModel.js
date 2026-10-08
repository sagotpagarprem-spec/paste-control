// Universal Pest Control — Meta Campaign Management Model (Phase 8)
const { query } = require('../config/database');

function parseJson(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function formatCampaign(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    objective: row.objective,
    status: row.status,
    dailyBudget: row.daily_budget ? Number(row.daily_budget) : null,
    lifetimeBudget: row.lifetime_budget ? Number(row.lifetime_budget) : null,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    targetAudience: parseJson(row.target_audience, {}),
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    leads: Number(row.leads || 0),
    cpl: Number(row.cpl || 0),
    conversions: Number(row.conversions || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatAdSet(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name || null,
    adsetId: row.adset_id,
    name: row.name,
    status: row.status,
    billingEvent: row.billing_event || 'IMPRESSIONS',
    optimizationGoal: row.optimization_goal || 'LEAD_GENERATION',
    targeting: parseJson(row.targeting, {}),
    budget: row.budget ? Number(row.budget) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatCreative(row) {
  if (!row) return null;
  return {
    id: row.id,
    creativeId: row.creative_id,
    name: row.name,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    headline: row.headline,
    primaryText: row.primary_text,
    description: row.description,
    cta: row.cta,
    destinationUrl: row.destination_url,
    instagramStorySpec: parseJson(row.instagram_story_spec, {}),
    aiGenerated: Boolean(row.ai_generated),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function formatAd(row) {
  if (!row) return null;
  return {
    id: row.id,
    adsetId: row.adset_id,
    adsetName: row.adset_name || null,
    campaignId: row.campaign_id || null,
    campaignName: row.campaign_name || null,
    adId: row.ad_id,
    name: row.name,
    creativeId: row.creative_id,
    creativeName: row.creative_name || null,
    headline: row.headline || null,
    primaryText: row.primary_text || null,
    imageUrl: row.image_url || null,
    videoUrl: row.video_url || null,
    cta: row.cta || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const campaignModel = {
  // ==========================================
  // CAMPAIGNS
  // ==========================================
  async getCampaigns({ status = '', search = '' } = {}) {
    let sql = `SELECT * FROM meta_campaigns WHERE 1=1`;
    const params = [];

    if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND name LIKE ?`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY created_at DESC`;
    const rows = await query(sql, params);
    return rows.map(formatCampaign);
  },

  async getCampaignById(id) {
    const rows = await query(`SELECT * FROM meta_campaigns WHERE id = ? OR campaign_id = ? LIMIT 1`, [id, id]);
    return rows.length > 0 ? formatCampaign(rows[0]) : null;
  },

  async createCampaign(data) {
    const campaignId = data.campaignId || `cmp_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const targetAudienceStr = data.targetAudience
      ? (typeof data.targetAudience === 'string' ? data.targetAudience : JSON.stringify(data.targetAudience))
      : null;

    const result = await query(
      `INSERT INTO meta_campaigns (
        campaign_id, name, objective, status, daily_budget, lifetime_budget,
        start_time, end_time, location, target_audience
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId,
        data.name,
        data.objective || 'OUTCOME_LEADS',
        data.status || 'DRAFT',
        data.dailyBudget || null,
        data.lifetimeBudget || null,
        data.startTime || null,
        data.endTime || null,
        data.location || 'Pune, Maharashtra',
        targetAudienceStr
      ]
    );

    return this.getCampaignById(result.insertId);
  },

  async updateCampaign(id, data) {
    const existing = await this.getCampaignById(id);
    if (!existing) return null;

    const updates = [];
    const params = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.objective !== undefined) { updates.push('objective = ?'); params.push(data.objective); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.dailyBudget !== undefined) { updates.push('daily_budget = ?'); params.push(data.dailyBudget); }
    if (data.lifetimeBudget !== undefined) { updates.push('lifetime_budget = ?'); params.push(data.lifetimeBudget); }
    if (data.startTime !== undefined) { updates.push('start_time = ?'); params.push(data.startTime); }
    if (data.endTime !== undefined) { updates.push('end_time = ?'); params.push(data.endTime); }
    if (data.location !== undefined) { updates.push('location = ?'); params.push(data.location); }
    if (data.campaignId !== undefined) { updates.push('campaign_id = ?'); params.push(data.campaignId); }
    if (data.targetAudience !== undefined) {
      updates.push('target_audience = ?');
      params.push(typeof data.targetAudience === 'string' ? data.targetAudience : JSON.stringify(data.targetAudience));
    }

    if (updates.length === 0) return existing;

    params.push(existing.id);
    await query(`UPDATE meta_campaigns SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getCampaignById(existing.id);
  },

  async updateStatus(id, newStatus) {
    const valid = ['DRAFT', 'REVIEW', 'READY', 'PUBLISH', 'PUBLISHED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
    const norm = String(newStatus).toUpperCase();
    if (!valid.includes(norm)) {
      throw new Error(`Invalid status: ${newStatus}. Allowed: ${valid.join(', ')}`);
    }

    await query(
      `UPDATE meta_campaigns SET status = ? WHERE id = ? OR campaign_id = ?`,
      [norm, id, id]
    );
    return this.getCampaignById(id);
  },

  async deleteCampaign(id) {
    await query(`DELETE FROM meta_campaigns WHERE id = ? OR campaign_id = ?`, [id, id]);
    return true;
  },

  async syncMetrics(id, metrics = {}) {
    await query(
      `UPDATE meta_campaigns SET
        spend = COALESCE(?, spend),
        impressions = COALESCE(?, impressions),
        clicks = COALESCE(?, clicks),
        leads = COALESCE(?, leads),
        cpl = COALESCE(?, cpl),
        conversions = COALESCE(?, conversions),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? OR campaign_id = ?`,
      [
        metrics.spend !== undefined ? metrics.spend : null,
        metrics.impressions !== undefined ? metrics.impressions : null,
        metrics.clicks !== undefined ? metrics.clicks : null,
        metrics.leads !== undefined ? metrics.leads : null,
        metrics.cpl !== undefined ? metrics.cpl : null,
        metrics.conversions !== undefined ? metrics.conversions : null,
        id,
        id
      ]
    );
    return this.getCampaignById(id);
  },

  // ==========================================
  // AD SETS
  // ==========================================
  async getAdSets({ campaignId = null, status = '' } = {}) {
    let sql = `
      SELECT s.*, c.name AS campaign_name
      FROM meta_ad_sets s
      LEFT JOIN meta_campaigns c ON s.campaign_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (campaignId) {
      sql += ` AND (s.campaign_id = ? OR c.campaign_id = ?)`;
      params.push(campaignId, campaignId);
    }
    if (status && status !== 'ALL') {
      sql += ` AND s.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY s.created_at DESC`;

    const rows = await query(sql, params);
    return rows.map(formatAdSet);
  },

  async getAdSetById(id) {
    const rows = await query(
      `SELECT s.*, c.name AS campaign_name
       FROM meta_ad_sets s
       LEFT JOIN meta_campaigns c ON s.campaign_id = c.id
       WHERE s.id = ? OR s.adset_id = ?
       LIMIT 1`,
      [id, id]
    );
    return rows.length > 0 ? formatAdSet(rows[0]) : null;
  },

  async createAdSet(data) {
    const adsetId = data.adsetId || `adset_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const targetingStr = data.targeting
      ? (typeof data.targeting === 'string' ? data.targeting : JSON.stringify(data.targeting))
      : null;

    const result = await query(
      `INSERT INTO meta_ad_sets (
        campaign_id, adset_id, name, status, billing_event, optimization_goal, targeting, budget
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.campaignId,
        adsetId,
        data.name,
        data.status || 'DRAFT',
        data.billingEvent || 'IMPRESSIONS',
        data.optimizationGoal || 'LEAD_GENERATION',
        targetingStr,
        data.budget || null
      ]
    );
    return this.getAdSetById(result.insertId);
  },

  async updateAdSet(id, data) {
    const existing = await this.getAdSetById(id);
    if (!existing) return null;

    const updates = [];
    const params = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.billingEvent !== undefined) { updates.push('billing_event = ?'); params.push(data.billingEvent); }
    if (data.optimizationGoal !== undefined) { updates.push('optimization_goal = ?'); params.push(data.optimizationGoal); }
    if (data.budget !== undefined) { updates.push('budget = ?'); params.push(data.budget); }
    if (data.adsetId !== undefined) { updates.push('adset_id = ?'); params.push(data.adsetId); }
    if (data.targeting !== undefined) {
      updates.push('targeting = ?');
      params.push(typeof data.targeting === 'string' ? data.targeting : JSON.stringify(data.targeting));
    }

    if (updates.length === 0) return existing;
    params.push(existing.id);
    await query(`UPDATE meta_ad_sets SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getAdSetById(existing.id);
  },

  async updateAdSetStatus(id, status) {
    await query(`UPDATE meta_ad_sets SET status = ? WHERE id = ? OR adset_id = ?`, [status, id, id]);
    return this.getAdSetById(id);
  },

  async deleteAdSet(id) {
    await query(`DELETE FROM meta_ad_sets WHERE id = ? OR adset_id = ?`, [id, id]);
    return true;
  },

  // ==========================================
  // CREATIVES (CONNECTED TO CREATIVE STUDIO)
  // ==========================================
  async getCreatives({ status = '' } = {}) {
    let sql = `SELECT * FROM meta_creatives WHERE 1=1`;
    const params = [];
    if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;
    const rows = await query(sql, params);
    return rows.map(formatCreative);
  },

  async getCreativeById(id) {
    const rows = await query(`SELECT * FROM meta_creatives WHERE id = ? OR creative_id = ? LIMIT 1`, [id, id]);
    return rows.length > 0 ? formatCreative(rows[0]) : null;
  },

  async createCreative(data) {
    const creativeId = data.creativeId || `cr_${Date.now()}`;
    const result = await query(
      `INSERT INTO meta_creatives (
        creative_id, name, image_url, video_url, headline, primary_text, description, cta, destination_url, ai_generated, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        creativeId,
        data.name,
        data.imageUrl || null,
        data.videoUrl || null,
        data.headline,
        data.primaryText,
        data.description || null,
        data.cta || 'GET_QUOTE',
        data.destinationUrl || null,
        Boolean(data.aiGenerated),
        data.status || 'DRAFT'
      ]
    );
    return this.getCreativeById(result.insertId);
  },

  async updateCreative(id, data) {
    const existing = await this.getCreativeById(id);
    if (!existing) return null;

    const updates = [];
    const params = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.imageUrl !== undefined) { updates.push('image_url = ?'); params.push(data.imageUrl); }
    if (data.videoUrl !== undefined) { updates.push('video_url = ?'); params.push(data.videoUrl); }
    if (data.headline !== undefined) { updates.push('headline = ?'); params.push(data.headline); }
    if (data.primaryText !== undefined) { updates.push('primary_text = ?'); params.push(data.primaryText); }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
    if (data.cta !== undefined) { updates.push('cta = ?'); params.push(data.cta); }
    if (data.destinationUrl !== undefined) { updates.push('destination_url = ?'); params.push(data.destinationUrl); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }

    if (updates.length === 0) return existing;
    params.push(existing.id);
    await query(`UPDATE meta_creatives SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getCreativeById(existing.id);
  },

  async updateCreativeStatus(id, status) {
    await query(`UPDATE meta_creatives SET status = ? WHERE id = ? OR creative_id = ?`, [status, id, id]);
    return this.getCreativeById(id);
  },

  async deleteCreative(id) {
    await query(`DELETE FROM meta_creatives WHERE id = ? OR creative_id = ?`, [id, id]);
    return true;
  },

  // ==========================================
  // ADS
  // ==========================================
  async getAds({ adsetId = null, campaignId = null, status = '' } = {}) {
    let sql = `
      SELECT a.*, s.name AS adset_name, c.id AS campaign_id, c.name AS campaign_name,
             cr.name AS creative_name, cr.headline, cr.primary_text, cr.image_url, cr.video_url, cr.cta
      FROM meta_ads a
      JOIN meta_ad_sets s ON a.adset_id = s.id
      JOIN meta_campaigns c ON s.campaign_id = c.id
      LEFT JOIN meta_creatives cr ON a.creative_id = cr.id
      WHERE 1=1
    `;
    const params = [];
    if (adsetId) {
      sql += ` AND (a.adset_id = ? OR s.adset_id = ?)`;
      params.push(adsetId, adsetId);
    }
    if (campaignId) {
      sql += ` AND (c.id = ? OR c.campaign_id = ?)`;
      params.push(campaignId, campaignId);
    }
    if (status && status !== 'ALL') {
      sql += ` AND a.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY a.created_at DESC`;

    const rows = await query(sql, params);
    return rows.map(formatAd);
  },

  async getAdById(id) {
    const rows = await query(
      `SELECT a.*, s.name AS adset_name, c.id AS campaign_id, c.name AS campaign_name,
              cr.name AS creative_name, cr.headline, cr.primary_text, cr.image_url, cr.video_url, cr.cta
       FROM meta_ads a
       JOIN meta_ad_sets s ON a.adset_id = s.id
       JOIN meta_campaigns c ON s.campaign_id = c.id
       LEFT JOIN meta_creatives cr ON a.creative_id = cr.id
       WHERE a.id = ? OR a.ad_id = ?
       LIMIT 1`,
      [id, id]
    );
    return rows.length > 0 ? formatAd(rows[0]) : null;
  },

  async createAd(data) {
    const adId = data.adId || `ad_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const result = await query(
      `INSERT INTO meta_ads (adset_id, ad_id, name, creative_id, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.adsetId,
        adId,
        data.name,
        data.creativeId || null,
        data.status || 'DRAFT'
      ]
    );
    return this.getAdById(result.insertId);
  },

  async updateAd(id, data) {
    const existing = await this.getAdById(id);
    if (!existing) return null;

    const updates = [];
    const params = [];

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.creativeId !== undefined) { updates.push('creative_id = ?'); params.push(data.creativeId); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.adId !== undefined) { updates.push('ad_id = ?'); params.push(data.adId); }

    if (updates.length === 0) return existing;
    params.push(existing.id);
    await query(`UPDATE meta_ads SET ${updates.join(', ')} WHERE id = ?`, params);
    return this.getAdById(existing.id);
  },

  async updateAdStatus(id, status) {
    await query(`UPDATE meta_ads SET status = ? WHERE id = ? OR ad_id = ?`, [status, id, id]);
    return this.getAdById(id);
  },

  async deleteAd(id) {
    await query(`DELETE FROM meta_ads WHERE id = ? OR ad_id = ?`, [id, id]);
    return true;
  },

  // ==========================================
  // PERFORMANCE & METRICS (NO FAKE DATA)
  // ==========================================
  async getPerformance(campaignId) {
    const campaign = await this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign #${campaignId} not found.`);
    }

    // 1. Cross-reference real CRM leads from MySQL `leads` table
    const leadRows = await query(
      `SELECT 
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status IN ('QUALIFIED', 'SITE_VISIT', 'QUOTATION', 'BOOKED', 'COMPLETED') THEN 1 ELSE 0 END) as qualified_leads,
        SUM(CASE WHEN status IN ('BOOKED', 'COMPLETED') THEN 1 ELSE 0 END) as converted_leads,
        SUM(estimated_value) as pipeline_value
       FROM leads
       WHERE (campaign = ? OR campaign_id = ? OR campaign LIKE ? OR (source LIKE '%LEAD_AD%' AND campaign IS NOT NULL))`,
      [campaign.name, campaign.campaignId, `%${campaign.name.slice(0, 10)}%`]
    );

    const crmStats = leadRows[0] || {};
    const crmLeads = Number(crmStats.total_leads || 0);
    const crmConversions = Number(crmStats.converted_leads || 0);
    const pipelineValue = Number(crmStats.pipeline_value || 0);

    // 2. Check if Meta Marketing API metrics are available or unavailable
    const hasLiveApiMetrics = Boolean(campaign.spend > 0 || campaign.impressions > 0 || campaign.clicks > 0);
    const totalLeads = Math.max(campaign.leads, crmLeads);
    const conversions = Math.max(campaign.conversions, crmConversions);

    const spend = campaign.spend;
    const impressions = campaign.impressions;
    const clicks = campaign.clicks;

    // Derived metrics
    const cpl = (spend > 0 && totalLeads > 0) ? Number((spend / totalLeads).toFixed(2)) : null;
    const ctr = (impressions > 0 && clicks > 0) ? Number(((clicks / impressions) * 100).toFixed(2)) : null;
    const cpc = (spend > 0 && clicks > 0) ? Number((spend / clicks).toFixed(2)) : null;
    const convRate = totalLeads > 0 ? Number(((conversions / totalLeads) * 100).toFixed(1)) : 0.0;
    const roas = (spend > 0 && pipelineValue > 0) ? Number((pipelineValue / spend).toFixed(2)) : null;

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      budget: campaign.dailyBudget ? `₹${campaign.dailyBudget}/day` : (campaign.lifetimeBudget ? `₹${campaign.lifetimeBudget} lifetime` : 'Dynamic'),
      // Clear transparency: explicitly report whether live API metrics are synced or unavailable
      apiDataAvailable: hasLiveApiMetrics,
      insightsStatus: hasLiveApiMetrics ? 'LIVE_SYNCED' : 'UNAVAILABLE_NOT_SYNCED',
      metrics: {
        spend: hasLiveApiMetrics ? spend : null,
        spendFormatted: hasLiveApiMetrics ? `₹${spend.toLocaleString()}` : 'Unavailable (API Not Synced)',
        impressions: hasLiveApiMetrics ? impressions : null,
        impressionsFormatted: hasLiveApiMetrics ? impressions.toLocaleString() : 'Unavailable',
        clicks: hasLiveApiMetrics ? clicks : null,
        clicksFormatted: hasLiveApiMetrics ? clicks.toLocaleString() : 'Unavailable',
        leads: totalLeads,
        crmLeadsRecorded: crmLeads,
        cpl: cpl !== null ? `₹${cpl}` : (hasLiveApiMetrics ? '₹0.00' : 'Unavailable'),
        ctr: ctr !== null ? `${ctr}%` : 'Unavailable',
        cpc: cpc !== null ? `₹${cpc}` : 'Unavailable',
        conversions,
        conversionRate: `${convRate}%`,
        pipelineValue: `₹${pipelineValue.toLocaleString()}`,
        roas: roas !== null ? `${roas}x` : 'Unavailable'
      }
    };
  }
};

module.exports = campaignModel;
