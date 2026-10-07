// Universal Pest Control — Audit Log Model
const { query } = require('../config/database');
const logger = require('../utils/logger');

const auditLogModel = {
  async log({ userId = null, action, entityType, entityId = null, ipAddress = null, userAgent = null, details = null }) {
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          action,
          entityType,
          entityId ? String(entityId) : null,
          ipAddress,
          userAgent ? userAgent.substring(0, 255) : null,
          details ? JSON.stringify(details) : null
        ]
      );
    } catch (err) {
      // Don't fail primary request if audit log fails
      logger.error('Failed to write audit log:', err);
    }
  },

  async getRecent(limit = 100) {
    return await query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [Number(limit)]
    );
  }
};

module.exports = auditLogModel;
