// Universal Pest Control — Notification Controller
const notificationModel = require('../models/notificationModel');
const { apiSuccess, apiError } = require('../utils/response');

const notificationController = {
  async getNotifications(req, res, next) {
    try {
      const { limit } = req.query;
      const result = await notificationModel.findAll({
        userId: req.user ? req.user.id : null,
        limit: limit || 50
      });
      return apiSuccess(res, result.notifications, 'Notifications retrieved.', 200, { unreadCount: result.unreadCount });
    } catch (error) {
      next(error);
    }
  },

  async markRead(req, res, next) {
    try {
      const { id } = req.params;
      await notificationModel.markRead(id, req.user ? req.user.id : null);
      return apiSuccess(res, true, 'Notification marked as read.');
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
  },

  async createNotification(req, res, next) {
    try {
      const { title, message, type, link } = req.body;
      if (!title || !message) {
        return apiError(res, 'Title and message are required.', 422);
      }
      const notif = await notificationModel.create({
        title,
        message,
        type: type || 'NEW_LEAD',
        userId: req.user ? req.user.id : null,
        link
      });
      return apiSuccess(res, notif, 'Notification created.', 201);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = notificationController;
