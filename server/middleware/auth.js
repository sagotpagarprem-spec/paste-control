// Universal Pest Control — Authentication Middleware
const { verifyToken } = require('../utils/jwt');
const { apiError } = require('../utils/response');
const { query } = require('../config/database');
const logger = require('../utils/logger');

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
      return apiError(res, 'Authentication required. No token provided.', 401);
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

    // Verify user in database if database is connected
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
      const roles = user.role_names ? user.role_names.split(',') : ['admin'];

      // Fetch user permissions
      const permRows = await query(
        `SELECT DISTINCT p.name
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN roles r ON rp.role_id = r.id
         WHERE r.name IN (${roles.map(() => '?').join(',') || 'NULL'})`,
        roles.length > 0 ? roles : ['admin']
      );

      const permissions = permRows.map(r => r.name);

      req.user = {
        id: user.id,
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        roles,
        permissions
      };
    } catch (dbErr) {
      // If DB is temporarily unavailable but token is validly signed, use token claims
      logger.warn(`Auth database lookup failed (${dbErr.message}), falling back to token claims.`);
      req.user = {
        id: decoded.id,
        uuid: decoded.uuid || 'temp-uuid',
        name: decoded.name || 'Admin User',
        email: decoded.email,
        roles: decoded.roles || ['admin'],
        permissions: decoded.permissions || ['*']
      };
    }

    return next();
  } catch (error) {
    logger.error('Unexpected error in authenticateToken:', error);
    return apiError(res, 'Authentication failed.', 500);
  }
}

module.exports = {
  authenticateToken
};
