// Universal Pest Control — Notification Controller
const notificationModel = require('../models/notificationModel');
const { apiSuccess } = require('../utils/response');

const notificationController = {
  async getNotifications(req, res, next) {
    try {
      const notifications = await notificationModel.findAll({
        userId: req.user ? req.user.id : null,
        limit: 50
      });
      return apiSuccess(res, notifications, 'Notifications retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async markAllRead(req, res, next) {
    try {
      await notificationModel.markAllRead(req.user ? req.user.id : null);
      return apiSuccess(res, true, 'All notifications marked as read.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = notificationController;
