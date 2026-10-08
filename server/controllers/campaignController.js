// Universal Pest Control — Campaign Controller (Phase 8)
const campaignModel = require('../models/campaignModel');
const campaignService = require('../services/campaignService');
const { apiSuccess, apiError } = require('../utils/response');

const campaignController = {
  // ==========================================
  // CAMPAIGNS
  // ==========================================
  async getCampaigns(req, res, next) {
    try {
      const { status, search } = req.query;
      const campaigns = await campaignModel.getCampaigns({ status, search });
      return apiSuccess(res, campaigns, 'Campaigns retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  async getCampaignById(req, res, next) {
    try {
      const { id } = req.params;
      const campaign = await campaignModel.getCampaignById(id);
      if (!campaign) {
        return apiError(res, 'Campaign not found.', 404);
      }
      return apiSuccess(res, campaign, 'Campaign details retrieved.');
    } catch (err) {
      next(err);
    }
  },

  async createCampaign(req, res, next) {
    try {
      const { name, objective, dailyBudget, lifetimeBudget, location, targetAudience } = req.body;
      if (!name) {
        return apiError(res, 'Campaign name is required.', 400);
      }
      const campaign = await campaignModel.createCampaign(req.body);
      return apiSuccess(res, campaign, 'Campaign created in DRAFT state.', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateCampaign(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await campaignModel.updateCampaign(id, req.body);
      if (!updated) {
        return apiError(res, 'Campaign not found.', 404);
      }
      return apiSuccess(res, updated, 'Campaign updated successfully.');
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return apiError(res, 'Target status is required.', 400);
      }
      const result = await campaignService.transitionStatus(id, status);
      return apiSuccess(res, result, `Campaign transitioned to ${status}.`);
    } catch (err) {
      next(err);
    }
  },

  async syncMetrics(req, res, next) {
    try {
      const { id } = req.params;
      const result = await campaignService.syncMetrics(id);
      return apiSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  },

  async getPerformance(req, res, next) {
    try {
      const { id } = req.params;
      const performance = await campaignModel.getPerformance(id);
      return apiSuccess(res, performance, 'Campaign performance metrics retrieved.');
    } catch (err) {
      next(err);
    }
  },

  async deleteCampaign(req, res, next) {
    try {
      const { id } = req.params;
      await campaignModel.deleteCampaign(id);
      return apiSuccess(res, { id }, 'Campaign deleted.');
    } catch (err) {
      next(err);
    }
  },

  // ==========================================
  // AD SETS
  // ==========================================
  async getAdSets(req, res, next) {
    try {
      const { campaignId, status } = req.query;
      const adSets = await campaignModel.getAdSets({ campaignId, status });
      return apiSuccess(res, adSets, 'Ad Sets retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  async getAdSetById(req, res, next) {
    try {
      const { id } = req.params;
      const adSet = await campaignModel.getAdSetById(id);
      if (!adSet) {
        return apiError(res, 'Ad Set not found.', 404);
      }
      return apiSuccess(res, adSet, 'Ad Set details retrieved.');
    } catch (err) {
      next(err);
    }
  },

  async createAdSet(req, res, next) {
    try {
      const { campaignId, name } = req.body;
      if (!campaignId || !name) {
        return apiError(res, 'campaignId and name are required.', 400);
      }
      const adSet = await campaignModel.createAdSet(req.body);
      return apiSuccess(res, adSet, 'Ad Set created successfully.', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateAdSet(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await campaignModel.updateAdSet(id, req.body);
      if (!updated) {
        return apiError(res, 'Ad Set not found.', 404);
      }
      return apiSuccess(res, updated, 'Ad Set updated.');
    } catch (err) {
      next(err);
    }
  },

  async updateAdSetStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return apiError(res, 'Status is required.', 400);
      }
      const updated = await campaignModel.updateAdSetStatus(id, status);
      return apiSuccess(res, updated, `Ad Set status updated to ${status}.`);
    } catch (err) {
      next(err);
    }
  },

  async deleteAdSet(req, res, next) {
    try {
      const { id } = req.params;
      await campaignModel.deleteAdSet(id);
      return apiSuccess(res, { id }, 'Ad Set deleted.');
    } catch (err) {
      next(err);
    }
  },

  // ==========================================
  // CREATIVES (CONNECTED WITH CREATIVE STUDIO)
  // ==========================================
  async getCreatives(req, res, next) {
    try {
      const { status } = req.query;
      const creatives = await campaignModel.getCreatives({ status });
      return apiSuccess(res, creatives, 'Creatives retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  async getCreativeById(req, res, next) {
    try {
      const { id } = req.params;
      const creative = await campaignModel.getCreativeById(id);
      if (!creative) {
        return apiError(res, 'Creative not found.', 404);
      }
      return apiSuccess(res, creative, 'Creative details retrieved.');
    } catch (err) {
      next(err);
    }
  },

  async createCreative(req, res, next) {
    try {
      const { name, headline, primaryText } = req.body;
      if (!name || !headline || !primaryText) {
        return apiError(res, 'Name, headline, and primaryText are required.', 400);
      }
      const creative = await campaignModel.createCreative(req.body);
      return apiSuccess(res, creative, 'Creative saved successfully.', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateCreative(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await campaignModel.updateCreative(id, req.body);
      if (!updated) {
        return apiError(res, 'Creative not found.', 404);
      }
      return apiSuccess(res, updated, 'Creative updated.');
    } catch (err) {
      next(err);
    }
  },

  async deleteCreative(req, res, next) {
    try {
      const { id } = req.params;
      await campaignModel.deleteCreative(id);
      return apiSuccess(res, { id }, 'Creative deleted.');
    } catch (err) {
      next(err);
    }
  },

  // ==========================================
  // ADS
  // ==========================================
  async getAds(req, res, next) {
    try {
      const { adsetId, campaignId, status } = req.query;
      const ads = await campaignModel.getAds({ adsetId, campaignId, status });
      return apiSuccess(res, ads, 'Ads retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  async getAdById(req, res, next) {
    try {
      const { id } = req.params;
      const ad = await campaignModel.getAdById(id);
      if (!ad) {
        return apiError(res, 'Ad not found.', 404);
      }
      return apiSuccess(res, ad, 'Ad details retrieved.');
    } catch (err) {
      next(err);
    }
  },

  async createAd(req, res, next) {
    try {
      const { adsetId, name } = req.body;
      if (!adsetId || !name) {
        return apiError(res, 'adsetId and name are required.', 400);
      }
      const ad = await campaignModel.createAd(req.body);
      return apiSuccess(res, ad, 'Ad created successfully.', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateAd(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await campaignModel.updateAd(id, req.body);
      if (!updated) {
        return apiError(res, 'Ad not found.', 404);
      }
      return apiSuccess(res, updated, 'Ad updated.');
    } catch (err) {
      next(err);
    }
  },

  async updateAdStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return apiError(res, 'Status is required.', 400);
      }
      const updated = await campaignModel.updateAdStatus(id, status);
      return apiSuccess(res, updated, `Ad status updated to ${status}.`);
    } catch (err) {
      next(err);
    }
  },

  async deleteAd(req, res, next) {
    try {
      const { id } = req.params;
      await campaignModel.deleteAd(id);
      return apiSuccess(res, { id }, 'Ad deleted.');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = campaignController;
