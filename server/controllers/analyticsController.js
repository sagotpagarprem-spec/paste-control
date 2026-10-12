// Universal Pest Control — Production Marketing Analytics Controller (Phase 10)
const analyticsModel = require('../models/analyticsModel');
const { apiSuccess, apiError } = require('../utils/response');

const analyticsController = {
  /**
   * GET /api/analytics/overview
   * Returns verified KPIs, attribution breakdown, service breakdown, location breakdown, and trends
   */
  async getOverview(req, res, next) {
    try {
      const data = await analyticsModel.getOverviewMetrics(req.query);
      return apiSuccess(res, data, 'Analytics overview retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/analytics/track
   * Public endpoint to log web pageviews with UTMs & click IDs (gclid/fbclid)
   */
  async trackPageView(req, res, next) {
    try {
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      const userAgent = req.headers['user-agent'] || null;

      const payload = {
        ...req.body,
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : ipAddress,
        userAgent
      };

      const result = await analyticsModel.trackPageView(payload);
      return apiSuccess(res, result, 'Pageview recorded.');
    } catch (err) {
      // Don't fail frontend tracking
      return apiSuccess(res, { tracked: false }, 'Pageview tracking skipped.');
    }
  }
};

module.exports = analyticsController;
