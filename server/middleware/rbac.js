// Universal Pest Control — Role-Based Access Control (RBAC) Middleware
const { apiError } = require('../utils/response');

/**
 * Check if the authenticated user has at least one of the specified roles.
 * Example: requireRole('admin', 'manager')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return apiError(res, 'Authentication required.', 401);
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return apiError(
        res,
        `Access forbidden. Requires one of the following roles: [${allowedRoles.join(', ')}].`,
        403
      );
    }

    return next();
  };
}

/**
 * Check if the authenticated user has the specified permission.
 * Admin role bypasses permission checks.
 * Example: requirePermission('leads:update')
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return apiError(res, 'Authentication required.', 401);
    }

    const userRoles = req.user.roles || [];
    // Superadmin bypass
    if (userRoles.includes('admin')) {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasAll = requiredPermissions.every(perm => userPermissions.includes(perm));

    if (!hasAll) {
      return apiError(
        res,
        `Access forbidden. Missing required permissions: [${requiredPermissions.join(', ')}].`,
        403
      );
    }

    return next();
  };
}

module.exports = {
  requireRole,
  requirePermission
};
