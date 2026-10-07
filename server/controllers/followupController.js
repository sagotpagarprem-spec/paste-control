// Universal Pest Control — Follow-up Controller
const followupModel = require('../models/followupModel');
const notificationModel = require('../models/notificationModel');
const { apiSuccess, apiError } = require('../utils/response');

const followupController = {
  async getFollowups(req, res, next) {
    try {
      const { filter, status, assignedTo, leadId, page, limit } = req.query;
      const result = await followupModel.findAll({
        filter,
        status,
        assignedTo,
        leadId,
        page: page || 1,
        limit: limit || 100
      });
      return apiSuccess(res, result.followups, 'Follow-ups retrieved.', 200, {
        summary: result.summary,
        ...result.pagination
      });
    } catch (error) {
      next(error);
    }
  },

  async getFollowupById(req, res, next) {
    try {
      const { id } = req.params;
      const followup = await followupModel.findById(id);
      if (!followup) {
        return apiError(res, 'Follow-up not found.', 404);
      }
      return apiSuccess(res, followup, 'Follow-up details retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createFollowup(req, res, next) {
    try {
      const { leadId, date } = req.body;
      if (!leadId) {
        return apiError(res, 'Lead ID is required for scheduling a follow-up.', 422);
      }
      if (!date) {
        return apiError(res, 'Scheduled follow-up date is required.', 422);
      }

      const followup = await followupModel.create(req.body, req.user?.id || null);

      // Create notification: FOLLOWUP_DUE
      await notificationModel.create({
        title: '📅 Follow-Up Scheduled',
        message: `Follow-up set for ${followup.customerName} on ${followup.scheduledDate} at ${followup.scheduledTime || '11:00 AM'}.`,
        type: 'FOLLOWUP_DUE',
        link: '/admin.html'
      });

      return apiSuccess(res, followup, 'Follow-up scheduled successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateFollowup(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await followupModel.update(id, req.body, req.user?.id || null);
      if (!updated) {
        return apiError(res, 'Follow-up not found.', 404);
      }
      return apiSuccess(res, updated, 'Follow-up updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteFollowup(req, res, next) {
    try {
      const { id } = req.params;
      await followupModel.delete(id);
      return apiSuccess(res, true, 'Follow-up removed.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = followupController;
