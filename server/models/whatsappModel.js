// Universal Pest Control — WhatsApp Model (Phase 6)
const { query } = require('../config/database');

function parseJson(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function formatMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    wamId: row.wam_id,
    direction: row.direction,
    toPhone: row.to_phone,
    fromPhone: row.from_phone,
    customerId: row.customer_id,
    leadId: row.lead_id,
    bookingId: row.booking_id,
    templateName: row.template_name,
    templateLanguage: row.template_language || 'en',
    messageType: row.message_type,
    body: row.body,
    status: (row.status || 'QUEUED').toUpperCase(),
    errorMessage: row.error_message,
    metadata: parseJson(row.metadata, {}),
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name || null,
    leadCode: row.lead_code || null,
    bookingCode: row.booking_code || null
  };
}

function formatTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    language: row.language,
    status: row.status,
    headerText: row.header_text,
    bodyText: row.body_text,
    footerText: row.footer_text,
    buttons: parseJson(row.buttons, []),
    variablesSample: parseJson(row.variables_sample, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const whatsappModel = {
  async getTemplates({ category = '', status = 'APPROVED' } = {}) {
    let sql = `SELECT * FROM whatsapp_templates WHERE 1=1`;
    const params = [];

    if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (category && category !== 'ALL') {
      sql += ` AND category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY name ASC`;
    const rows = await query(sql, params);
    return rows.map(formatTemplate);
  },

  async getTemplateByName(name) {
    const rows = await query(`SELECT * FROM whatsapp_templates WHERE name = ? LIMIT 1`, [name]);
    return rows.length > 0 ? formatTemplate(rows[0]) : null;
  },

  async createMessage(data) {
    const wamId = data.wamId || data.wam_id || `wamid.UPC${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const direction = (data.direction || 'OUTBOUND').toUpperCase();
    const toPhone = data.toPhone || data.to_phone;
    const fromPhone = data.fromPhone || data.from_phone || '+91 98230 01122';
    const messageType = data.messageType || data.message_type || (data.templateName ? 'TEMPLATE' : 'TEXT');
    const status = (data.status || 'QUEUED').toUpperCase();
    const metadata = data.metadata ? (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)) : null;

    const result = await query(
      `INSERT INTO whatsapp_messages (
        wam_id, direction, to_phone, from_phone, customer_id, lead_id, booking_id,
        template_name, template_language, message_type, body, status, error_message, metadata,
        delivered_at, read_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wamId,
        direction,
        toPhone,
        fromPhone,
        data.customerId || data.customer_id || null,
        data.leadId || data.lead_id || null,
        data.bookingId || data.booking_id || null,
        data.templateName || data.template_name || null,
        data.templateLanguage || data.template_language || 'en',
        messageType,
        data.body,
        status,
        data.errorMessage || data.error_message || null,
        metadata,
        status === 'DELIVERED' || status === 'READ' ? new Date() : null,
        status === 'READ' ? new Date() : null
      ]
    );

    return this.getMessageById(result.insertId);
  },

  async getMessageById(id) {
    const rows = await query(
      `SELECT m.*, c.name AS customer_name, l.lead_code, b.booking_code
       FROM whatsapp_messages m
       LEFT JOIN customers c ON m.customer_id = c.id
       LEFT JOIN leads l ON m.lead_id = l.id
       LEFT JOIN bookings b ON m.booking_id = b.id
       WHERE m.id = ? LIMIT 1`,
      [id]
    );
    return rows.length > 0 ? formatMessage(rows[0]) : null;
  },

  async getMessageByWamId(wamId) {
    const rows = await query(
      `SELECT m.*, c.name AS customer_name, l.lead_code, b.booking_code
       FROM whatsapp_messages m
       LEFT JOIN customers c ON m.customer_id = c.id
       LEFT JOIN leads l ON m.lead_id = l.id
       LEFT JOIN bookings b ON m.booking_id = b.id
       WHERE m.wam_id = ? LIMIT 1`,
      [wamId]
    );
    return rows.length > 0 ? formatMessage(rows[0]) : null;
  },

  async updateMessageStatus(wamIdOrId, status, errorMessage = null) {
    const normalized = String(status).toUpperCase();
    const valid = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'];
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid message status: ${status}. Must be one of: ${valid.join(', ')}`);
    }

    const updates = ['status = ?'];
    const params = [normalized];

    if (errorMessage) {
      updates.push('error_message = ?');
      params.push(errorMessage);
    }
    if (normalized === 'DELIVERED') {
      updates.push('delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)');
    }
    if (normalized === 'READ') {
      updates.push('delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)');
      updates.push('read_at = COALESCE(read_at, CURRENT_TIMESTAMP)');
    }

    const isNumeric = Number.isInteger(Number(wamIdOrId)) && !isNaN(parseInt(wamIdOrId, 10)) && !String(wamIdOrId).includes('.');
    if (isNumeric) {
      params.push(parseInt(wamIdOrId, 10), String(wamIdOrId));
      await query(
        `UPDATE whatsapp_messages SET ${updates.join(', ')} WHERE id = ? OR wam_id = ?`,
        params
      );
    } else {
      params.push(String(wamIdOrId));
      await query(
        `UPDATE whatsapp_messages SET ${updates.join(', ')} WHERE wam_id = ?`,
        params
      );
    }

    const rows = isNumeric
      ? await query(`SELECT * FROM whatsapp_messages WHERE id = ? OR wam_id = ? LIMIT 1`, [parseInt(wamIdOrId, 10), String(wamIdOrId)])
      : await query(`SELECT * FROM whatsapp_messages WHERE wam_id = ? LIMIT 1`, [String(wamIdOrId)]);
    return rows.length > 0 ? formatMessage(rows[0]) : null;
  },

  async getConversations({ search = '', limit = 50, offset = 0 } = {}) {
    // Find all distinct conversation phone numbers with latest message and contact context
    const sql = `
      SELECT 
        CASE WHEN m.direction = 'OUTBOUND' THEN m.to_phone ELSE m.from_phone END as contact_phone,
        MAX(m.id) as latest_message_id,
        MAX(m.created_at) as last_activity,
        COUNT(CASE WHEN m.direction = 'INBOUND' AND m.status != 'READ' THEN 1 END) as unread_count,
        MAX(m.customer_id) as customer_id,
        MAX(m.lead_id) as lead_id
      FROM whatsapp_messages m
      GROUP BY contact_phone
      ORDER BY last_activity DESC
      LIMIT ? OFFSET ?
    `;

    const convRows = await query(sql, [Number(limit), Number(offset)]);
    if (convRows.length === 0) return [];

    const latestIds = convRows.map(r => r.latest_message_id);
    const messages = await query(
      `SELECT m.*, c.name AS customer_name, c.email AS customer_email,
              l.name AS lead_name, l.service_name AS lead_service, l.lead_code
       FROM whatsapp_messages m
       LEFT JOIN customers c ON m.customer_id = c.id
       LEFT JOIN leads l ON m.lead_id = l.id
       WHERE m.id IN (${latestIds.map(() => '?').join(',')})`,
      latestIds
    );

    const msgMap = new Map();
    messages.forEach(m => msgMap.set(m.id, m));

    let results = convRows.map(r => {
      const msg = msgMap.get(r.latest_message_id) || {};
      const contactName = msg.customer_name || msg.lead_name || 'Customer';

      return {
        phone: r.contact_phone,
        contactName,
        customerEmail: msg.customer_email || null,
        customerId: r.customer_id,
        leadId: r.lead_id,
        leadCode: msg.lead_code || null,
        service: msg.lead_service || 'Pest Control',
        unreadCount: Number(r.unread_count || 0),
        lastActivity: r.last_activity,
        latestMessage: {
          id: msg.id,
          wamId: msg.wam_id,
          direction: msg.direction,
          body: msg.body,
          templateName: msg.template_name,
          status: (msg.status || 'SENT').toUpperCase(),
          createdAt: msg.created_at
        }
      };
    });

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(c => 
        c.phone.toLowerCase().includes(q) || 
        c.contactName.toLowerCase().includes(q) ||
        c.service.toLowerCase().includes(q)
      );
    }

    return results;
  },

  async getMessagesByPhone(phone, { limit = 100, offset = 0 } = {}) {
    const cleanPhone = phone.replace(/\s+/g, '');
    const cleanWithPlus = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
    const cleanNoPlus = cleanPhone.replace(/^\+/, '');

    const rows = await query(
      `SELECT m.*, c.name AS customer_name, l.lead_code, b.booking_code
       FROM whatsapp_messages m
       LEFT JOIN customers c ON m.customer_id = c.id
       LEFT JOIN leads l ON m.lead_id = l.id
       LEFT JOIN bookings b ON m.booking_id = b.id
       WHERE m.to_phone = ? OR m.from_phone = ? 
          OR m.to_phone = ? OR m.from_phone = ?
          OR REPLACE(m.to_phone, ' ', '') = ? OR REPLACE(m.from_phone, ' ', '') = ?
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [cleanWithPlus, cleanWithPlus, cleanNoPlus, cleanNoPlus, cleanPhone, cleanPhone, Number(limit), Number(offset)]
    );

    return rows.map(formatMessage);
  }
};

module.exports = whatsappModel;
