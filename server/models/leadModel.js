// Universal Pest Control — Lead Model (Data Access Layer)
const { query } = require('../config/database');

function formatLead(lead, notes = [], activities = [], bookings = []) {
  if (!lead) return null;
  const formattedActivities = (activities || []).map(a => ({
    ...a,
    id: a.id,
    activityType: a.activity_type,
    activity_type: a.activity_type,
    description: a.description,
    userName: a.user_name,
    user_name: a.user_name,
    createdAt: a.created_at,
    created_at: a.created_at
  }));

  const formattedNotes = (notes || []).map(n => ({
    ...n,
    id: n.id,
    note: n.note,
    authorName: n.author_name,
    author_name: n.author_name,
    createdAt: n.created_at,
    created_at: n.created_at
  }));

  return {
    ...lead,
    leadCode: lead.lead_code,
    customerId: lead.customer_id,
    service: lead.service_name,
    serviceName: lead.service_name,
    property: lead.property_type,
    propertyType: lead.property_type,
    adName: lead.ad_name,
    campaignId: lead.campaign_id,
    adsetName: lead.adset_name,
    adSet: lead.adset_name,
    adsetId: lead.adset_id,
    adSetId: lead.adset_id,
    adId: lead.ad_id,
    platform: lead.platform,
    leadgenId: lead.leadgen_id,
    utmSource: lead.utm_source,
    utmMedium: lead.utm_medium,
    utmCampaign: lead.utm_campaign,
    utmContent: lead.utm_content,
    utmTerm: lead.utm_term,
    landingPage: lead.landing_page,
    estimatedValue: lead.estimated_value,
    assignedTo: lead.assigned_to,
    assignedToName: lead.assigned_to_name,
    assignedToEmail: lead.assigned_to_email,
    followUpDate: lead.follow_up_date,
    isDuplicate: Boolean(lead.is_duplicate),
    duplicateCount: lead.duplicate_count,
    duplicateOfId: lead.duplicate_of_id,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    notes: formattedNotes,
    timeline: formattedActivities,
    activities: formattedActivities,
    bookings: bookings || []
  };
}

const leadModel = {
  /**
   * Find leads with advanced search, filtering, and pagination
   */
  async findAll({ search = '', status = '', service = '', source = '', assignedTo = '', page = 1, limit = 50 } = {}) {
    let baseSql = `
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      // Normalize status comparison (e.g., SITE_VISIT vs SITE VISIT, FOLLOW_UP vs FOLLOW-UP)
      const normalizedStatus = status.replace(/[\-_]/g, ' ').toUpperCase();
      baseSql += ` AND (UPPER(REPLACE(REPLACE(l.status, '-', ' '), '_', ' ')) = ? OR UPPER(l.status) = ?)`;
      params.push(normalizedStatus, status.toUpperCase());
    }

    if (service) {
      baseSql += ` AND (l.service_name LIKE ? OR l.service_id = ?)`;
      params.push(`%${service}%`, isNaN(service) ? -1 : Number(service));
    }

    if (source) {
      baseSql += ` AND l.source LIKE ?`;
      params.push(`%${source}%`);
    }

    if (assignedTo) {
      baseSql += ` AND (l.assigned_to = ? OR u.name LIKE ?)`;
      params.push(isNaN(assignedTo) ? -1 : Number(assignedTo), `%${assignedTo}%`);
    }

    if (search) {
      baseSql += ` AND (
        l.name LIKE ? OR
        l.phone LIKE ? OR
        l.email LIKE ? OR
        l.service_name LIKE ? OR
        l.area LIKE ? OR
        l.city LIKE ? OR
        l.lead_code LIKE ? OR
        l.campaign LIKE ? OR
        l.utm_source LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s);
    }

    // 1. Get Total Count
    const countRows = await query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = countRows[0]?.total || 0;

    // 2. Get Paginated Records
    const offset = Math.max(0, (Number(page) - 1) * Number(limit));
    const selectSql = `
      SELECT l.id, l.lead_code, l.customer_id, l.name, l.phone, l.email,
             l.service_name, l.property_type, l.city, l.area, l.address, l.message,
             l.source, l.campaign, l.ad_name, l.utm_source, l.utm_medium,
             l.utm_campaign, l.utm_content, l.utm_term, l.fbclid, l.gclid,
             l.landing_page, l.referrer, l.status, l.urgency, l.estimated_value,
             l.assigned_to, l.follow_up_date, l.is_duplicate, l.duplicate_count,
             l.duplicate_of_id, l.created_at, l.updated_at,
             u.name AS assigned_to_name, u.email AS assigned_to_email
      ${baseSql}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, Number(limit), Number(offset)];
    const rawLeads = await query(selectSql, queryParams);
    const leads = rawLeads.map(l => formatLead(l));

    return {
      leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    };
  },

  /**
   * Find single lead with notes, activity timeline, and associated booking
   */
  async findById(id) {
    const rows = await query(
      `SELECT l.*, u.name AS assigned_to_name, u.email AS assigned_to_email
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE l.id = ? OR l.lead_code = ?
       LIMIT 1`,
      [id, id]
    );
    if (rows.length === 0) return null;
    const lead = rows[0];

    // Fetch notes
    const notes = await query(
      `SELECT ln.id, ln.note, ln.created_at, u.name as author_name
       FROM lead_notes ln
       LEFT JOIN users u ON ln.user_id = u.id
       WHERE ln.lead_id = ?
       ORDER BY ln.created_at DESC`,
      [lead.id]
    );

    // Fetch timeline activities
    const activities = await query(
      `SELECT la.id, la.activity_type, la.description, la.created_at, u.name as user_name
       FROM lead_activities la
       LEFT JOIN users u ON la.user_id = u.id
       WHERE la.lead_id = ?
       ORDER BY la.created_at DESC`,
      [lead.id]
    );

    // Fetch any associated bookings
    const bookings = await query(
      `SELECT b.id, b.booking_code, b.service_name, b.scheduled_date, b.time_slot, b.amount, b.status
       FROM bookings b
       WHERE b.lead_id = ? OR (b.phone = ? AND b.phone != '')
       ORDER BY b.scheduled_date DESC
       LIMIT 5`,
      [lead.id, lead.phone]
    );

    return formatLead(lead, notes, activities, bookings);
  },

  /**
   * Find recent existing lead for duplicate detection
   */
  async findRecentByPhone(phone, hours = 48) {
    if (!phone) return null;
    // Strip special characters to match phone consistently
    const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
    const rows = await query(
      `SELECT * FROM leads
       WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ?
         AND created_at >= NOW() - INTERVAL ? HOUR
         AND status NOT IN ('COMPLETED', 'LOST')
       ORDER BY created_at DESC
       LIMIT 1`,
      [`%${cleanPhone.slice(-10)}%`, hours]
    );
    return rows[0] || null;
  },

  /**
   * Record duplicate attempt on original lead
   */
  async recordDuplicateOnOriginal(originalLeadId, duplicateInfo) {
    await query(
      `UPDATE leads SET duplicate_count = duplicate_count + 1 WHERE id = ?`,
      [originalLeadId]
    );

    const desc = `Repeat inquiry received via ${duplicateInfo.source || 'Website'} for service: ${duplicateInfo.service || 'General'}.`;
    await query(
      `INSERT INTO lead_activities (lead_id, activity_type, description)
       VALUES (?, 'DUPLICATE_SUBMISSION', ?)`,
      [originalLeadId, desc]
    );

    if (duplicateInfo.message || duplicateInfo.notes) {
      const noteText = `[Repeat Inquiry]: ${duplicateInfo.message || duplicateInfo.notes}`;
      await query(`INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)`, [originalLeadId, noteText]);
    }
  },

  /**
   * Create new lead with full attribution & tracking data
   */
  async create(data) {
    const leadCode = data.lead_code || `LD-${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO leads (
        lead_code, customer_id, name, phone, email, service_name,
        property_type, city, area, address, message,
        source, platform, campaign, campaign_id, adset_name, adset_id, ad_name, ad_id, leadgen_id, raw_meta_payload,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid,
        landing_page, referrer, status, urgency, estimated_value,
        assigned_to, follow_up_date, is_duplicate, duplicate_count, duplicate_of_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const rawPayloadStr = data.raw_meta_payload
      ? (typeof data.raw_meta_payload === 'string' ? data.raw_meta_payload : JSON.stringify(data.raw_meta_payload))
      : null;

    const params = [
      leadCode,
      data.customer_id || null,
      data.name,
      data.phone,
      data.email || null,
      data.service || data.service_name || 'General Pest Control',
      data.property || data.property_type || data.propertyType || 'Residential',
      data.city || 'Pune',
      data.area || null,
      data.address || null,
      data.message || data.notes || null,
      data.source || 'Website',
      data.platform || null,
      data.campaign || data.utm_campaign || data.utmCampaign || null,
      data.campaign_id || data.campaignId || null,
      data.adset_name || data.adSet || data.adsetName || null,
      data.adset_id || data.adSetId || data.adsetId || null,
      data.ad_name || data.ad || data.adName || null,
      data.ad_id || data.adId || null,
      data.leadgen_id || data.leadgenId || null,
      rawPayloadStr,
      data.utm_source || data.utmSource || null,
      data.utm_medium || data.utmMedium || null,
      data.utm_campaign || data.utmCampaign || null,
      data.utm_content || data.utmContent || null,
      data.utm_term || data.utmTerm || null,
      data.fbclid || null,
      data.gclid || null,
      data.landing_page || data.landingPage || null,
      data.referrer || null,
      data.status || 'NEW',
      data.urgency || 'Today',
      data.value || data.estimated_value || data.estimatedValue || 0.00,
      data.assigned_to || data.assignedTo || null,
      data.follow_up_date || data.followUpDate || null,
      Boolean(data.is_duplicate || data.isDuplicate),
      Number(data.duplicate_count || data.duplicateCount || 0),
      data.duplicate_of_id || data.duplicateOfId || null
    ];

    const result = await query(sql, params);
    const newLeadId = result.insertId;

    // Add initial activity
    const activityDesc = data.is_duplicate
      ? `Lead received as flagged duplicate (linked to #${data.duplicate_of_id})`
      : `Lead created via ${data.source || 'Website'}`;

    await query(
      `INSERT INTO lead_activities (lead_id, activity_type, description)
       VALUES (?, 'CREATED', ?)`,
      [newLeadId, activityDesc]
    );

    if (data.notes || data.message) {
      await query(`INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)`, [newLeadId, data.notes || data.message]);
    }

    return this.findById(newLeadId);
  },

  /**
   * Update lead attributes, status, assignment, or notes
   */
  async update(id, data, currentUserId = null) {
    const fields = [];
    const params = [];

    // Map camelCase to snake_case if present
    const cleanData = {
      ...data,
      service_name: data.service_name || data.service,
      property_type: data.property_type || data.propertyType || data.property,
      estimated_value: data.estimated_value !== undefined ? data.estimated_value : (data.value !== undefined ? data.value : data.estimatedValue),
      assigned_to: data.assigned_to !== undefined ? data.assigned_to : data.assignedTo,
      follow_up_date: data.follow_up_date !== undefined ? data.follow_up_date : data.followUpDate
    };

    const allowed = [
      'name', 'phone', 'email', 'service_name', 'property_type',
      'city', 'area', 'address', 'message', 'status', 'urgency',
      'estimated_value', 'assigned_to', 'follow_up_date'
    ];

    for (const key of allowed) {
      if (cleanData[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(cleanData[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    // Fetch existing state for activity tracking
    const existingRows = await query(`SELECT * FROM leads WHERE id = ? OR lead_code = ? LIMIT 1`, [id, id]);
    if (existingRows.length === 0) return null;
    const existing = existingRows[0];

    params.push(id, id);
    await query(`UPDATE leads SET ${fields.join(', ')} WHERE id = ? OR lead_code = ?`, params);

    // Track status change activity
    if (cleanData.status && cleanData.status !== existing.status) {
      await query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
         VALUES (?, ?, 'STATUS_CHANGE', CONCAT('Status changed from ', ?, ' to ', ?))`,
        [existing.id, currentUserId, existing.status, cleanData.status]
      );
    }

    // Track assignment change activity
    if (cleanData.assigned_to !== undefined && cleanData.assigned_to !== existing.assigned_to) {
      let assigneeName = 'Unassigned';
      if (cleanData.assigned_to) {
        const uRows = await query(`SELECT name FROM users WHERE id = ? LIMIT 1`, [cleanData.assigned_to]);
        if (uRows.length > 0) assigneeName = uRows[0].name;
      }
      await query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
         VALUES (?, ?, 'ASSIGNMENT', CONCAT('Lead assigned to ', ?))`,
        [existing.id, currentUserId, assigneeName]
      );
    }

    // Track value change activity
    if (cleanData.estimated_value !== undefined && Number(cleanData.estimated_value) !== Number(existing.estimated_value)) {
      await query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
         VALUES (?, ?, 'VALUE_CHANGE', CONCAT('Estimated deal value updated to ₹', ?))`,
        [existing.id, currentUserId, Number(cleanData.estimated_value).toLocaleString()]
      );
    }

    return this.findById(existing.id);
  },

  /**
   * Add note and record in activities
   */
  async addNote(leadId, note, userId = null) {
    const lead = await query(`SELECT id FROM leads WHERE id = ? OR lead_code = ? LIMIT 1`, [leadId, leadId]);
    if (lead.length === 0) return null;

    const actualId = lead[0].id;
    await query(`INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)`, [actualId, userId, note]);
    await query(
      `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
       VALUES (?, ?, 'NOTE_ADDED', CONCAT('Note added: ', LEFT(?, 75)))`,
      [actualId, userId, note]
    );

    return this.findById(actualId);
  }
};

module.exports = leadModel;
