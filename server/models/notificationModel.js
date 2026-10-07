// Universal Pest Control — Notification Model
const { query } = require('../config/database');

function formatNotification(n) {
  if (!n) return null;
  return {
    ...n,
    id: n.id,
    userId: n.user_id,
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: Boolean(n.is_read),
    unread: !Boolean(n.is_read),
    link: n.link || null,
    createdAt: n.created_at
  };
}

const notificationModel = {
  formatNotification,

  async findAll({ userId = null, limit = 50 } = {}) {
    let sql = `SELECT * FROM notifications WHERE 1=1`;
    const params = [];
    if (userId) {
      sql += ` AND (user_id = ? OR user_id IS NULL)`;
      params.push(userId);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(Number(limit));

    const rawRows = await query(sql, params);
    const notifications = rawRows.map(formatNotification);

    // Count unread
    let countSql = `SELECT COUNT(*) AS unread_count FROM notifications WHERE is_read = FALSE`;
    const countParams = [];
    if (userId) {
      countSql += ` AND (user_id = ? OR user_id IS NULL)`;
      countParams.push(userId);
    }
    const countRows = await query(countSql, countParams);
    const unreadCount = Number(countRows[0]?.unread_count || 0);

    return {
      notifications,
      unreadCount
    };
  },

  async markRead(id, userId = null) {
    if (userId) {
      await query(`UPDATE notifications SET is_read = TRUE WHERE id = ? AND (user_id = ? OR user_id IS NULL)`, [id, userId]);
    } else {
      await query(`UPDATE notifications SET is_read = TRUE WHERE id = ?`, [id]);
    }
    return true;
  },

  async markAllRead(userId = null) {
    if (userId) {
      await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = ? OR user_id IS NULL`, [userId]);
    } else {
      await query(`UPDATE notifications SET is_read = TRUE`);
    }
    return true;
  },

  /**
   * Types: NEW_LEAD, FOLLOWUP_DUE, BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_ASSIGNED, BOOKING_COMPLETED
   */
  async create({ title, message, type = 'NEW_LEAD', userId = null, link = null }) {
    const validTypes = [
      'NEW_LEAD',
      'FOLLOWUP_DUE',
      'BOOKING_CREATED',
      'BOOKING_CONFIRMED',
      'BOOKING_ASSIGNED',
      'BOOKING_COMPLETED',
      'info',
      'warning',
      'success'
    ];
    const finalType = validTypes.includes(type) ? type : 'info';

    const result = await query(
      `INSERT INTO notifications (user_id, title, message, type, is_read, link)
       VALUES (?, ?, ?, ?, FALSE, ?)`,
      [userId, title, message, finalType, link]
    );
    const rows = await query(`SELECT * FROM notifications WHERE id = ?`, [result.insertId]);
    return formatNotification(rows[0] || null);
  }
};

module.exports = notificationModel;
