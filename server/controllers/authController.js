// Universal Pest Control — Auth Controller
const authService = require('../services/authService');
const { verifyToken } = require('../utils/jwt');
const { apiSuccess, apiError } = require('../utils/response');

const authController = {
  /**
   * POST /api/auth/login
   * Authenticate admin/staff user, set HttpOnly session cookie and return user profile
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login({ email, password, ipAddress, userAgent });

      // Secure HttpOnly session cookie
      res.cookie('upc_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });

      return apiSuccess(
        res,
        {
          user: result.user,
          token: result.token,
          sessionId: result.sessionId,
          expiresIn: '24h'
        },
        'Authentication successful.'
      );
    } catch (error) {
      if (error.message.includes('Invalid email or password')) {
        return apiError(res, 'Invalid email or password.', 401);
      }
      next(error);
    }
  },

  /**
   * POST /api/auth/logout
   * Invalidate session in MySQL, clear HttpOnly cookie, and log audit
   */
  async logout(req, res, next) {
    try {
      let sessionId = req.session?.sessionId || req.user?.sessionId;

      if (!sessionId) {
        // Try extracting from cookie or Bearer token if not already in req
        const cookieToken = req.cookies?.upc_token;
        const authHeader = req.headers['authorization'];
        const token = cookieToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);
        if (token) {
          try {
            const decoded = verifyToken(token);
            sessionId = decoded.sessionId;
          } catch (e) {}
        }
      }

      await authService.logout({
        sessionId,
        userId: req.user?.id,
        ipAddress: req.ip || req.connection.remoteAddress
      });

      // Clear HttpOnly session cookie
      res.clearCookie('upc_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/'
      });

      return apiSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/auth/me
   * Return current authenticated user profile
   */
  async getMe(req, res, next) {
    try {
      if (!req.user || !req.user.id) {
        return apiError(res, 'Authentication required.', 401);
      }
      const user = await authService.getMe(req.user.id);
      return apiSuccess(res, user, 'Authenticated user profile retrieved.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = authController;
