// Universal Pest Control — Follow-up Model
const { query } = require('../config/database');

function formatFollowup(f) {
  if (!f) return null;
  return {
    ...f,
    id: f.id,
    leadId: f.lead_id,
    leadCode: f.lead_code || null,
    customerName: f.lead_name || f.customer_name || 'Customer',
    phone: f.lead_phone || f.phone || null,
    service: f.service_name || null,
    assignedTo: f.assigned_to,
    assignedToName: f.assigned_to_name || null,
    date: f.scheduled_date,
    scheduledDate: f.scheduled_date,
    time: f.scheduled_time,
    scheduledTime: f.scheduled_time,
    notes: f.notes,
    status: f.status,
    completedAt: f.completed_at,
    createdAt: f.created_at,
    updatedAt: f.updated_at
  };
}

const followupModel = {
  formatFollowup,

  async getDashboardSummary() {
    const rows = await query(`
      SELECT
        COUNT(CASE WHEN scheduled_date < CURDATE() AND status = 'PENDING' THEN 1 END) AS overdue_count,
        COUNT(CASE WHEN scheduled_date = CURDATE() AND status = 'PENDING' THEN 1 END) AS today_count,
        COUNT(CASE WHEN scheduled_date > CURDATE() AND status = 'PENDING' THEN 1 END) AS upcoming_count,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_count,
        COUNT(*) AS total_count
      FROM followups
    `);
    const counts = rows[0] || {};
    return {
      overdue: Number(counts.overdue_count || 0),
      today: Number(counts.today_count || 0),
      upcoming: Number(counts.upcoming_count || 0),
      completed: Number(counts.completed_count || 0),
      total: Number(counts.total_count || 0)
    };
  },

  async findAll({ filter = '', status = '', assignedTo = '', leadId = '', page = 1, limit = 50 } = {}) {
    let baseSql = `
      FROM followups fu
      JOIN leads l ON fu.lead_id = l.id
      LEFT JOIN users u ON fu.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filter === 'overdue') {
      baseSql += ` AND fu.scheduled_date < CURDATE() AND fu.status = 'PENDING'`;
    } else if (filter === 'today') {
      baseSql += ` AND fu.scheduled_date = CURDATE() AND fu.status = 'PENDING'`;
    } else if (filter === 'upcoming') {
      baseSql += ` AND fu.scheduled_date > CURDATE() AND fu.status = 'PENDING'`;
    } else if (filter === 'completed') {
      baseSql += ` AND fu.status = 'COMPLETED'`;
    }

    if (status) {
      baseSql += ` AND fu.status = ?`;
      params.push(status.toUpperCase());
    }

    if (assignedTo) {
      baseSql += ` AND fu.assigned_to = ?`;
      params.push(Number(assignedTo));
    }

    if (leadId) {
      baseSql += ` AND fu.lead_id = ?`;
      params.push(Number(leadId));
    }

    const countRows = await query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = countRows[0]?.total || 0;

    const offset = Math.max(0, (Number(page) - 1) * Number(limit));
    const selectSql = `
      SELECT fu.*,
             l.lead_code, l.name AS lead_name, l.phone AS lead_phone, l.service_name,
             u.name AS assigned_to_name
      ${baseSql}
      ORDER BY
        CASE WHEN fu.status = 'PENDING' AND fu.scheduled_date < CURDATE() THEN 1
             WHEN fu.status = 'PENDING' AND fu.scheduled_date = CURDATE() THEN 2
             WHEN fu.status = 'PENDING' THEN 3
             ELSE 4 END,
        fu.scheduled_date ASC, fu.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, Number(limit), Number(offset)];
    const rawRows = await query(selectSql, queryParams);
    const followups = rawRows.map(formatFollowup);
    const summary = await this.getDashboardSummary();

    return {
      followups,
      summary,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    };
  },

  async findById(id) {
    const rows = await query(
      `SELECT fu.*,
              l.lead_code, l.name AS lead_name, l.phone AS lead_phone, l.service_name,
              u.name AS assigned_to_name
       FROM followups fu
       JOIN leads l ON fu.lead_id = l.id
       LEFT JOIN users u ON fu.assigned_to = u.id
       WHERE fu.id = ?
       LIMIT 1`,
      [id]
    );
    return formatFollowup(rows[0] || null);
  },

  async create(data, currentUserId = null) {
    const leadId = data.lead_id || data.leadId;
    const scheduledDate = data.date || data.scheduled_date || data.scheduledDate || new Date().toISOString().split('T')[0];
    const scheduledTime = data.time || data.scheduled_time || data.scheduledTime || '11:00 AM';
    const assignedTo = data.assigned_to !== undefined ? data.assigned_to : (data.assignedTo || currentUserId || null);
    const notes = data.notes || '';
    const status = (data.status ? String(data.status).toUpperCase() : 'PENDING');

    const result = await query(
      `INSERT INTO followups (lead_id, assigned_to, scheduled_date, scheduled_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [leadId, assignedTo, scheduledDate, scheduledTime, notes, status]
    );

    // Update lead's follow_up_date
    await query(`UPDATE leads SET follow_up_date = ? WHERE id = ?`, [scheduledDate, leadId]);

    // Record activity on lead timeline
    await query(
      `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
       VALUES (?, ?, 'FOLLOWUP_SCHEDULED', ?)`,
      [leadId, currentUserId, `Follow-up scheduled for ${scheduledDate} at ${scheduledTime}. Note: ${notes || 'Follow-up call'}`]
    );

    return this.findById(result.insertId);
  },

  async update(id, data, currentUserId = null) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    const fieldMap = {
      scheduled_date: data.date || data.scheduled_date || data.scheduledDate,
      scheduled_time: data.time || data.scheduled_time || data.scheduledTime,
      assigned_to: data.assigned_to !== undefined ? data.assigned_to : data.assignedTo,
      notes: data.notes,
      status: data.status ? String(data.status).toUpperCase() : undefined
    };

    if (fieldMap.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      fields.push(`completed_at = NOW()`);
    }

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(val);
      }
    }

    if (fields.length > 0) {
      params.push(id);
      await query(`UPDATE followups SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    // Activity tracking on lead
    if (fieldMap.status && fieldMap.status !== existing.status) {
      await query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
         VALUES (?, ?, 'FOLLOWUP_STATUS', ?)`,
        [existing.leadId, currentUserId, `Follow-up status changed to ${fieldMap.status}`]
      );
    }

    return this.findById(id);
  },

  async delete(id) {
    await query(`DELETE FROM followups WHERE id = ?`, [id]);
    return true;
  }
};

module.exports = followupModel;
