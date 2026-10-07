// Universal Pest Control — Notification Model
const { query } = require('../config/database');

const notificationModel = {
  async findAll({ userId = null, limit = 50 } = {}) {
    let sql = `SELECT * FROM notifications WHERE 1=1`;
    const params = [];
    if (userId) {
      sql += ` AND (user_id = ? OR user_id IS NULL)`;
      params.push(userId);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(Number(limit));
    return await query(sql, params);
  },

  async markAllRead(userId = null) {
    if (userId) {
      await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = ? OR user_id IS NULL`, [userId]);
    } else {
      await query(`UPDATE notifications SET is_read = TRUE`);
    }
    return true;
  },

  async create({ title, message, type = 'info', userId = null, link = null }) {
    const result = await query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, link)
       VALUES (?, ?, ?, ?, FALSE, ?)`,
      [userId, title, message, type, link]
    );
    const rows = await query(`SELECT * FROM notifications WHERE id = ?`, [result.insertId]);
    return rows[0] || null;
  }
};

module.exports = notificationModel;
