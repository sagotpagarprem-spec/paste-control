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
    location: lead.area ? `${lead.area}, ${lead.city || 'Pune'}` : (lead.city || 'Pune'),
    adName: lead.ad_name,
    ad: lead.ad_name,
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
    preferredDate: lead.preferred_date || null,
    preferred_date: lead.preferred_date || null,
    preferredTime: lead.preferred_time || null,
    preferred_time: lead.preferred_time || null,
    adminNotes: lead.admin_notes || null,
    admin_notes: lead.admin_notes || null,
    estimatedValue: lead.estimated_value,
    estimatedAmount: lead.estimated_value,
    assignedTo: lead.assigned_to,
    assignedToName: lead.assigned_to_name,
    assignedToEmail: lead.assigned_to_email,
    assignedTechnicianId: lead.assigned_technician_id || null,
    assigned_technician_id: lead.assigned_technician_id || null,
    technicianName: lead.technician_name || null,
    technician_name: lead.technician_name || null,
    followUpDate: lead.follow_up_date,
    isDuplicate: Boolean(lead.is_duplicate),
    duplicateCount: lead.duplicate_count,
    duplicateOfId: lead.duplicate_of_id,
    isArchived: Boolean(lead.is_archived),
    is_archived: Boolean(lead.is_archived),
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
  async findAll({
    search = '',
    status = '',
    service = '',
    source = '',
    assignedTo = '',
    includeArchived = false,
    page = 1,
    limit = 50
  } = {}) {
    let baseSql = `
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN technicians t ON l.assigned_technician_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (!includeArchived) {
      baseSql += ` AND (l.is_archived IS NULL OR l.is_archived = FALSE)`;
    }

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
      baseSql += ` AND (l.assigned_to = ? OR l.assigned_technician_id = ? OR u.name LIKE ? OR t.name LIKE ?)`;
      const numId = isNaN(assignedTo) ? -1 : Number(assignedTo);
      params.push(numId, numId, `%${assignedTo}%`, `%${assignedTo}%`);
    }

    if (search) {
      baseSql += ` AND (
        l.name LIKE ? OR
        l.phone LIKE ? OR
        l.email LIKE ? OR
        l.service_name LIKE ? OR
        l.area LIKE ? OR
        l.city LIKE ? OR
        l.address LIKE ? OR
        l.lead_code LIKE ? OR
        l.campaign LIKE ? OR
        l.utm_source LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s);
    }

    // 1. Get Total Count
    const countRows = await query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = countRows[0]?.total || 0;

    // 2. Get Paginated Records
    const offset = Math.max(0, (Number(page) - 1) * Number(limit));
    const selectSql = `
      SELECT l.id, l.lead_code, l.customer_id, l.name, l.phone, l.email,
             l.service_name, l.property_type, l.city, l.area, l.address, l.message,
             l.preferred_date, l.preferred_time, l.admin_notes,
             l.source, l.platform, l.campaign, l.campaign_id, l.adset_name, l.adset_id,
             l.ad_name, l.ad_id, l.leadgen_id, l.utm_source, l.utm_medium,
             l.utm_campaign, l.utm_content, l.utm_term, l.fbclid, l.gclid,
             l.landing_page, l.referrer, l.status, l.urgency, l.estimated_value,
             l.assigned_to, l.assigned_technician_id, l.follow_up_date,
             l.is_duplicate, l.duplicate_count, l.duplicate_of_id, l.is_archived,
             l.created_at, l.updated_at,
             u.name AS assigned_to_name, u.email AS assigned_to_email,
             t.name AS technician_name
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
      `SELECT l.*,
              u.name AS assigned_to_name, u.email AS assigned_to_email,
              t.name AS technician_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       LEFT JOIN technicians t ON l.assigned_technician_id = t.id
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

    // Fetch linked bookings if any
    let bookings = [];
    try {
      bookings = await query(
        `SELECT b.id, b.booking_code, b.service_name, b.status, b.scheduled_date, b.time_slot AS scheduled_time, b.time_slot
         FROM bookings b
         WHERE b.lead_id = ?`,
        [lead.id]
      );
    } catch (e) {}

    return formatLead(lead, notes, activities, bookings);
  },

  /**
   * Check for duplicate inquiry within windowHours (default 48h)
   */
  async findRecentByPhone(phone, windowHours = 48) {
    const rows = await query(
      `SELECT id, lead_code, name, phone, email, status, service_name, created_at, duplicate_count
       FROM leads
       WHERE phone = ? AND created_at >= NOW() - INTERVAL ? HOUR
       ORDER BY id DESC
       LIMIT 1`,
      [phone, windowHours]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Increment duplicate count and log note on original lead
   */
  async recordDuplicateOnOriginal(originalId, newInquiryData) {
    await query(
      `UPDATE leads
       SET duplicate_count = duplicate_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [originalId]
    );

    const desc = `Repeat inquiry received from ${newInquiryData.source || 'Website'} for ${newInquiryData.service || 'service'}${newInquiryData.message ? `: "${newInquiryData.message}"` : ''}`;
    await query(
      `INSERT INTO lead_activities (lead_id, activity_type, description)
       VALUES (?, 'DUPLICATE_SUBMISSION', ?)`,
      [originalId, desc]
    );
  },

  /**
   * Create new lead with full attribution & tracking data
   */
  async create(data) {
    const leadCode = data.lead_code || `LD-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
    const sql = `
      INSERT INTO leads (
        lead_code, customer_id, name, phone, email, service_name,
        property_type, city, area, address, message,
        preferred_date, preferred_time, admin_notes,
        source, platform, campaign, campaign_id, adset_name, adset_id, ad_name, ad_id, leadgen_id, raw_meta_payload,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid,
        landing_page, referrer, status, urgency, estimated_value,
        assigned_to, assigned_technician_id, follow_up_date,
        is_duplicate, duplicate_count, duplicate_of_id, is_archived, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const rawPayloadStr = data.raw_meta_payload
      ? (typeof data.raw_meta_payload === 'string' ? data.raw_meta_payload : JSON.stringify(data.raw_meta_payload))
      : null;

    const createdAtVal = data.created_at || data.createdAt ? new Date(data.created_at || data.createdAt) : new Date();

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
      data.preferred_date || data.preferredDate || null,
      data.preferred_time || data.preferredTime || null,
      data.admin_notes || data.adminNotes || null,
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
      data.value || data.estimated_value || data.estimatedValue || data.estimated_amount || data.estimatedAmount || 0.00,
      data.assigned_to || data.assignedTo || null,
      data.assigned_technician_id || data.technicianId || null,
      data.follow_up_date || data.followUpDate || null,
      Boolean(data.is_duplicate || data.isDuplicate),
      Number(data.duplicate_count || data.duplicateCount || 0),
      data.duplicate_of_id || data.duplicateOfId || null,
      Boolean(data.is_archived || data.isArchived || false),
      createdAtVal
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

    if (data.notes || data.message || data.admin_notes) {
      await query(`INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)`, [newLeadId, data.notes || data.message || data.admin_notes]);
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
      estimated_value: data.estimated_value !== undefined ? data.estimated_value : (data.value !== undefined ? data.value : (data.estimatedValue !== undefined ? data.estimatedValue : (data.estimated_amount !== undefined ? data.estimated_amount : data.estimatedAmount))),
      assigned_to: data.assigned_to !== undefined ? data.assigned_to : data.assignedTo,
      assigned_technician_id: data.assigned_technician_id !== undefined ? data.assigned_technician_id : (data.technicianId !== undefined ? data.technicianId : data.assignedTechnicianId),
      follow_up_date: data.follow_up_date !== undefined ? data.follow_up_date : data.followUpDate,
      preferred_date: data.preferred_date !== undefined ? data.preferred_date : data.preferredDate,
      preferred_time: data.preferred_time !== undefined ? data.preferred_time : data.preferredTime,
      admin_notes: data.admin_notes !== undefined ? data.admin_notes : data.adminNotes,
      is_archived: data.is_archived !== undefined ? Boolean(data.is_archived) : (data.isArchived !== undefined ? Boolean(data.isArchived) : undefined)
    };

    const allowed = [
      'name', 'phone', 'email', 'service_name', 'property_type',
      'city', 'area', 'address', 'message', 'status', 'urgency',
      'estimated_value', 'assigned_to', 'assigned_technician_id',
      'follow_up_date', 'preferred_date', 'preferred_time',
      'admin_notes', 'is_archived'
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

    // Track staff assignment change activity
    if (cleanData.assigned_to !== undefined && cleanData.assigned_to !== existing.assigned_to) {
      let assigneeName = 'Unassigned';
      if (cleanData.assigned_to) {
        const uRows = await query(`SELECT name FROM users WHERE id = ? LIMIT 1`, [cleanData.assigned_to]);
        if (uRows.length > 0) assigneeName = uRows[0].name;
      }
      await query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
         VALUES (?, ?, 'ASSIGNMENT', CONCAT('Lead assigned to staff: ', ?))`,
        [existing.id, currentUserId, assigneeName]
      );
    }

    // Track technician assignment change activity
    if (cleanData.assigned_technician_id !== undefined && cleanData.assigned_technician_id !== existing.assigned_technician_id) {
      let techName = 'Unassigned';
      if (cleanData.assigned_technician_id) {
        const tRows = await query(`SELECT name FROM technicians WHERE id = ? LIMIT 1`, [cleanData.assigned_technician_id]);
        if (tRows.length > 0) techName = tRows[0].name;
      }
      await query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
         VALUES (?, ?, 'ASSIGNMENT', CONCAT('Lead assigned to field technician: ', ?))`,
        [existing.id, currentUserId, techName]
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

    // Track archive activity
    if (cleanData.is_archived === true && !existing.is_archived) {
      await query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
         VALUES (?, ?, 'ARCHIVED', 'Lead was archived.')`,
        [existing.id, currentUserId]
      );
    }

    return this.findById(existing.id);
  },

  /**
   * Update lead status specifically
   */
  async updateStatus(id, status, currentUserId = null) {
    return this.update(id, { status }, currentUserId);
  },

  /**
   * Assign lead to technician or staff member
   */
  async assign(id, { userId = null, technicianId = null } = {}, currentUserId = null) {
    const updateData = {};
    if (userId !== undefined) updateData.assigned_to = userId;
    if (technicianId !== undefined) updateData.assigned_technician_id = technicianId;
    return this.update(id, updateData, currentUserId);
  },

  /**
   * Soft-delete / Archive lead
   */
  async archive(id, currentUserId = null) {
    return this.update(id, { is_archived: true }, currentUserId);
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

    // Also update admin_notes summary field on leads table
    await query(`UPDATE leads SET admin_notes = ? WHERE id = ?`, [note, actualId]);

    return this.findById(actualId);
  }
};

module.exports = leadModel;
