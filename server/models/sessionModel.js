// Universal Pest Control — Session Model (MySQL Persistence)
const { query } = require('../config/database');
const logger = require('../utils/logger');

const sessionModel = {
  /**
   * Create a new session in MySQL
   */
  async create({ id, userId, tokenHash = null, ipAddress = null, userAgent = null, expiresAt }) {
    await query(
      `INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, tokenHash, ipAddress, userAgent ? String(userAgent).substring(0, 500) : null, expiresAt]
    );
    return { id, userId, expiresAt };
  },

  /**
   * Find an active, non-expired session by ID
   */
  async findById(id) {
    if (!id) return null;

    const rows = await query(
      `SELECT s.id AS session_id, s.user_id, s.token_hash, s.ip_address, s.user_agent, s.expires_at, s.created_at,
              u.uuid, u.name, u.email, u.phone, u.avatar_url, u.is_active,
              GROUP_CONCAT(DISTINCT r.name) AS role_names
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
       GROUP BY s.id, u.id
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      user: {
        id: row.user_id,
        uuid: row.uuid,
        name: row.name,
        email: row.email,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        isActive: Boolean(row.is_active),
        roles: row.role_names ? row.role_names.split(',') : ['admin']
      }
    };
  },

  /**
   * Update session last active time
   */
  async touch(id) {
    if (!id) return;
    try {
      await query(`UPDATE user_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    } catch (err) {
      logger.warn(`Failed to touch session ${id}: ${err.message}`);
    }
  },

  /**
   * Delete a session on logout
   */
  async delete(id) {
    if (!id) return;
    await query(`DELETE FROM user_sessions WHERE id = ?`, [id]);
  },

  /**
   * Delete all sessions for a user (e.g., password reset / account deactivation)
   */
  async deleteByUserId(userId) {
    if (!userId) return;
    await query(`DELETE FROM user_sessions WHERE user_id = ?`, [userId]);
  },

  /**
   * Clean up expired sessions from MySQL
   */
  async cleanExpired() {
    try {
      const result = await query(`DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP`);
      return result.affectedRows || 0;
    } catch (err) {
      logger.warn(`Failed to clean expired sessions: ${err.message}`);
      return 0;
    }
  }
};

module.exports = sessionModel;
