// Universal Pest Control — User Model (Data Access Layer)
const { query } = require('../config/database');
const crypto = require('crypto');

const userModel = {
  async findByEmail(email) {
    const rows = await query(
      `SELECT u.id, u.uuid, u.name, u.email, u.password_hash, u.phone, u.avatar_url, u.is_active,
              GROUP_CONCAT(DISTINCT r.name) AS role_names
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE LOWER(u.email) = LOWER(?)
       GROUP BY u.id
       LIMIT 1`,
      [email.trim()]
    );
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      ...u,
      roles: u.role_names ? u.role_names.split(',') : []
    };
  },

  async findById(id) {
    const rows = await query(
      `SELECT u.id, u.uuid, u.name, u.email, u.phone, u.avatar_url, u.is_active, u.created_at,
              GROUP_CONCAT(DISTINCT r.name) AS role_names
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = ?
       GROUP BY u.id
       LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      ...u,
      roles: u.role_names ? u.role_names.split(',') : []
    };
  },

  async updateLastLogin(id) {
    await query(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
  },

  async create({ name, email, passwordHash, phone = null }) {
    const uuid = crypto.randomUUID();
    const result = await query(
      `INSERT INTO users (uuid, name, email, password_hash, phone, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [uuid, name, email.toLowerCase().trim(), passwordHash, phone]
    );
    return { id: result.insertId, uuid, name, email };
  }
};

module.exports = userModel;
