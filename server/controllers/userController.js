// Universal Pest Control — User & Staff Controller
const { query } = require('../config/database');
const { apiSuccess } = require('../utils/response');

const userController = {
  async getStaffUsers(req, res, next) {
    try {
      const rows = await query(
        `SELECT u.id, u.uuid, u.name, u.email, u.phone, u.avatar_url,
                GROUP_CONCAT(DISTINCT r.name) as role_names
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.is_active = TRUE
         GROUP BY u.id
         ORDER BY u.name ASC`
      );

      const users = rows.map(u => ({
        id: u.id,
        uuid: u.uuid,
        name: u.name,
        email: u.email,
        phone: u.phone,
        avatarUrl: u.avatar_url,
        roles: u.role_names ? u.role_names.split(',') : []
      }));

      return apiSuccess(res, users, 'Staff users list retrieved.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = userController;
