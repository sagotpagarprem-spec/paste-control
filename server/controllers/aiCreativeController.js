// Universal Pest Control — AI Creative Controller (Phase 9)
const aiCreativeService = require('../services/aiCreativeService');
const { apiSuccess, apiError } = require('../utils/response');

const aiCreativeController = {
  async generate(req, res, next) {
    try {
      const { service, location, audience, offer, tone, platform, format } = req.body;
      if (!service) {
        return apiError(res, 'Service name is required to generate creative assets.', 400);
      }

      const generated = await aiCreativeService.generateContent({
        service,
        location,
        audience,
        offer,
        tone,
        platform,
        format
      });

      return apiSuccess(res, generated, 'AI creative assets generated successfully.');
    } catch (err) {
      if (err.status) {
        return apiError(res, err.message, err.status, err.code);
      }
      next(err);
    }
  },

  async save(req, res, next) {
    try {
      const saved = await aiCreativeService.saveGeneration(req.body, req.user?.id || null);
      return apiSuccess(res, saved, 'Creative draft saved successfully.', 201);
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { status, limit } = req.query;
      const list = await aiCreativeService.listGenerations({ status, limit });
      return apiSuccess(res, list, 'Saved creative generations retrieved.');
    } catch (err) {
      next(err);
    }
  },

  async approve(req, res, next) {
    try {
      const { id } = req.params;
      const result = await aiCreativeService.approveAndSyncCreative(id);
      return apiSuccess(res, result, 'Creative approved and synchronized to Meta campaign studio.');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = aiCreativeController;
