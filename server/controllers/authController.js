// Universal Pest Control — Auth Controller
const authService = require('../services/authService');
const auditLogModel = require('../models/auditLogModel');
const { apiSuccess, apiError } = require('../utils/response');

const authController = {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login({ email, password, ipAddress, userAgent });

      // Optional: Set secure HTTP-only cookie if required
      res.cookie('upc_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return apiSuccess(res, result, 'Authentication successful.');
    } catch (error) {
      if (error.message.includes('Invalid email or password') || error.message.includes('deactivated')) {
        return apiError(res, error.message, 401);
      }
      next(error);
    }
  },

  async logout(req, res, next) {
    try {
      if (req.user) {
        await auditLogModel.log({
          userId: req.user.id,
          action: 'USER_LOGOUT',
          entityType: 'auth',
          entityId: String(req.user.id),
          ipAddress: req.ip || req.connection.remoteAddress
        });
      }

      res.clearCookie('upc_token');
      return apiSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getMe(req, res, next) {
    try {
      const user = await authService.getMe(req.user.id);
      return apiSuccess(res, user, 'Authenticated user profile retrieved.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = authController;
