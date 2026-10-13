// Universal Pest Control — Authentication & Authorization Middleware
const { verifyToken } = require('../utils/jwt');
const { apiError } = require('../utils/response');
const { query } = require('../config/database');
const sessionModel = require('../models/sessionModel');
const { requireRole, requirePermission } = require('./rbac');
const logger = require('../utils/logger');

/**
 * Authenticate incoming requests via HttpOnly cookie or Bearer token
 * Validates session persistence in MySQL if a session ID is present.
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.upc_token) {
      token = req.cookies.upc_token;
    }

    if (!token) {
      return apiError(res, 'Authentication required. No session or token provided.', 401);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return apiError(res, 'Session token has expired. Please log in again.', 401);
      }
      return apiError(res, 'Invalid authentication token.', 401);
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // 1. If token includes a session ID, validate MySQL server-side session
    if (decoded.sessionId) {
      try {
        const session = await sessionModel.findById(decoded.sessionId);
        if (!session) {
          return apiError(res, 'Session has expired or was revoked. Please log in again.', 401);
        }

        if (!session.user || !session.user.isActive) {
          return apiError(res, 'User account is inactive or not found.', 401);
        }

        // Fetch user permissions strictly from database
        const roles = Array.isArray(session.user.roles) ? session.user.roles : [];
        let permissions = [];

        if (roles.length > 0) {
          const permRows = await query(
            `SELECT DISTINCT p.name
             FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             JOIN roles r ON rp.role_id = r.id
             WHERE r.name IN (${roles.map(() => '?').join(',')})`,
            roles
          );
          permissions = permRows.map(r => r.name);
        }

        req.session = {
          sessionId: session.sessionId,
          expiresAt: session.expiresAt
        };

        req.user = {
          id: session.user.id,
          uuid: session.user.uuid,
          name: session.user.name,
          email: session.user.email,
          phone: session.user.phone,
          avatarUrl: session.user.avatarUrl,
          roles,
          permissions,
          sessionId: session.sessionId
        };

        // Touch session to record activity
        sessionModel.touch(session.sessionId).catch(() => {});

        return next();
      } catch (dbErr) {
        if (isProduction) {
          logger.error(`Session database lookup failed in production: ${dbErr.message}`);
          return apiError(res, 'Authorization service unavailable. Session could not be verified.', 401);
        }
        logger.warn(`Session database lookup failed (${dbErr.message}), falling back to token validation in development.`);
      }
    }

    // 2. Direct database user lookup (for stateless tokens / testing / API keys)
    try {
      const userRows = await query(
        `SELECT u.id, u.uuid, u.name, u.email, u.phone, u.avatar_url, u.is_active,
                GROUP_CONCAT(DISTINCT r.name) AS role_names
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.id = ?
         GROUP BY u.id`,
        [decoded.id]
      );

      if (userRows.length === 0 || !userRows[0].is_active) {
        return apiError(res, 'User account is inactive or not found.', 401);
      }

      const user = userRows[0];
      const roles = user.role_names ? user.role_names.split(',').map(r => r.trim()).filter(Boolean) : [];
      let permissions = [];

      if (roles.length > 0) {
        const permRows = await query(
          `SELECT DISTINCT p.name
           FROM permissions p
           JOIN role_permissions rp ON p.id = rp.permission_id
           JOIN roles r ON rp.role_id = r.id
           WHERE r.name IN (${roles.map(() => '?').join(',')})`,
          roles
        );
        permissions = permRows.map(r => r.name);
      }

      req.user = {
        id: user.id,
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        roles,
        permissions,
        sessionId: decoded.sessionId || null
      };
    } catch (dbErr) {
      if (isProduction) {
        // In production, NEVER grant unverified access on DB failure
        logger.error(`Auth database lookup failed in production: ${dbErr.message}`);
        return apiError(res, 'Authorization service unavailable. Unable to verify user account.', 401);
      }

      // In non-production tests/development, preserve explicitly signed token claims ONLY.
      // NEVER inject admin roles or wildcard permissions!
      logger.warn(`Auth database lookup failed (${dbErr.message}), falling back to explicit token claims.`);
      const fallbackRoles = Array.isArray(decoded.roles)
        ? decoded.roles
        : (decoded.role ? [decoded.role] : []);
      const fallbackPermissions = Array.isArray(decoded.permissions)
        ? decoded.permissions
        : [];

      req.user = {
        id: decoded.id,
        uuid: decoded.uuid || 'temp-uuid',
        name: decoded.name || 'User',
        email: decoded.email,
        roles: fallbackRoles,
        permissions: fallbackPermissions,
        sessionId: decoded.sessionId || null
      };
    }

    return next();
  } catch (error) {
    logger.error('Unexpected error in authenticateToken:', error);
    return apiError(res, 'Authentication failed.', 500);
  }
}

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission
};
