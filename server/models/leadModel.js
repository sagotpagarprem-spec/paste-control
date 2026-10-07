// Universal Pest Control — Lead Model (Data Access Layer)
const { query, transaction } = require('../config/database');

const leadModel = {
  async findAll({ search = '', status = '', limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT l.id, l.lead_code, l.name, l.phone, l.email, l.service_name,
             l.property_type, l.city, l.area, l.source, l.campaign, l.ad_name,
             l.status, l.urgency, l.estimated_value, l.follow_up_date,
             l.created_at, l.updated_at,
             u.name AS assigned_to_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND l.status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (l.name LIKE ? OR l.phone LIKE ? OR l.service_name LIKE ? OR l.area LIKE ? OR l.lead_code LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    sql += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    return await query(sql, params);
  },

  async findById(id) {
    const rows = await query(
      `SELECT l.*, u.name AS assigned_to_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE l.id = ? OR l.lead_code = ?
       LIMIT 1`,
      [id, id]
    );
    if (rows.length === 0) return null;
    const lead = rows[0];

    // Fetch notes and activities
    const notes = await query(
      `SELECT ln.id, ln.note, ln.created_at, u.name as author_name
       FROM lead_notes ln
       LEFT JOIN users u ON ln.user_id = u.id
       WHERE ln.lead_id = ?
       ORDER BY ln.created_at DESC`,
      [lead.id]
    );

    const activities = await query(
      `SELECT la.id, la.activity_type, la.description, la.created_at, u.name as user_name
       FROM lead_activities la
       LEFT JOIN users u ON la.user_id = u.id
       WHERE la.lead_id = ?
       ORDER BY la.created_at DESC`,
      [lead.id]
    );

    return {
      ...lead,
      notes,
      timeline: activities
    };
  },

  async create(data) {
    const leadCode = data.lead_code || `LD-${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO leads (
        lead_code, name, phone, email, service_name,
        property_type, city, area, source, campaign,
        ad_name, status, urgency, estimated_value, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      leadCode,
      data.name,
      data.phone,
      data.email || null,
      data.service || data.service_name || 'General Pest Control',
      data.property || data.property_type || 'Residential',
      data.city || 'Pune',
      data.area || null,
      data.source || 'Website',
      data.campaign || null,
      data.ad_name || null,
      data.status || 'NEW',
      data.urgency || 'Today',
      data.value || data.estimated_value || 0.00,
      data.assigned_to || null
    ];

    const result = await query(sql, params);
    const newLeadId = result.insertId;

    // Add initial activity
    await query(
      `INSERT INTO lead_activities (lead_id, activity_type, description)
       VALUES (?, 'CREATED', CONCAT('Lead created via ', ?))`,
      [newLeadId, data.source || 'Website']
    );

    if (data.notes) {
      await query(`INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)`, [newLeadId, data.notes]);
    }

    return this.findById(newLeadId);
  },

  async update(id, data, currentUserId = null) {
    const fields = [];
    const params = [];

    const allowed = [
      'name', 'phone', 'email', 'service_name', 'property_type',
      'city', 'area', 'status', 'urgency', 'estimated_value',
      'assigned_to', 'follow_up_date'
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    params.push(id, id);
    await query(`UPDATE leads SET ${fields.join(', ')} WHERE id = ? OR lead_code = ?`, params);

    // If status changed, record timeline activity
    if (data.status) {
      const current = await query(`SELECT id FROM leads WHERE id = ? OR lead_code = ? LIMIT 1`, [id, id]);
      if (current.length > 0) {
        await query(
          `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
           VALUES (?, ?, 'STATUS_CHANGE', CONCAT('Status updated to: ', ?))`,
          [current[0].id, currentUserId, data.status]
        );
      }
    }

    return this.findById(id);
  },

  async addNote(leadId, note, userId = null) {
    const lead = await query(`SELECT id FROM leads WHERE id = ? OR lead_code = ? LIMIT 1`, [leadId, leadId]);
    if (lead.length === 0) return null;

    const actualId = lead[0].id;
    await query(`INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)`, [actualId, userId, note]);
    await query(
      `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
       VALUES (?, ?, 'NOTE_ADDED', CONCAT('Note added: ', LEFT(?, 50)))`,
      [actualId, userId, note]
    );

    return this.findById(actualId);
  }
};

module.exports = leadModel;
