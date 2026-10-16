// Universal Pest Control — Booking Model (Phase 5)
const crypto = require('crypto');
const { query } = require('../config/database');

function formatBooking(b) {
  if (!b) return null;
  return {
    ...b,
    id: b.id,
    bookingId: b.id,
    bookingCode: b.booking_code,
    leadId: b.lead_id,
    customerId: b.customer_id,
    serviceId: b.service_id,
    service: b.service_name,
    serviceName: b.service_name,
    technicianId: b.technician_id,
    technicianName: b.technician_name || null,
    technicianPhone: b.technician_phone || null,
    technicianEmail: b.technician_email || null,
    technicianProfileImage: b.technician_profile_image || null,
    technicianAvailability: b.technician_availability || null,
    customerName: b.customer_name,
    phone: b.phone,
    propertyType: b.property_type,
    scheduledDate: b.scheduled_date,
    date: b.scheduled_date,
    timeSlot: b.time_slot,
    address: b.address,
    city: b.city || 'Pune',
    instructions: b.instructions || b.notes || null,
    notes: b.notes || null,
    amount: Number(b.amount || 0),
    status: (b.status || 'PENDING').toUpperCase(),
    assignedAt: b.assigned_at,
    acceptedAt: b.accepted_at,
    onTheWayAt: b.on_the_way_at,
    arrivedAt: b.arrived_at,
    startedAt: b.started_at,
    completedAt: b.completed_at,
    cancelledAt: b.cancelled_at,
    isArchived: Boolean(b.is_archived),
    createdAt: b.created_at,
    updatedAt: b.updated_at
  };
}

const bookingModel = {
  formatBooking,

  async findAll({ search = '', status = '', technicianId = '', date = '', includeArchived = false, page = 1, limit = 50, offset = 0 } = {}) {
    let baseSql = `
      FROM bookings b
      LEFT JOIN technicians t ON b.technician_id = t.id
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (!includeArchived) {
      baseSql += ` AND (b.is_archived IS NULL OR b.is_archived = FALSE)`;
    }

    if (status) {
      const normStatus = status.replace(/[\-_]/g, ' ').toUpperCase();
      baseSql += ` AND (UPPER(REPLACE(REPLACE(b.status, '-', ' '), '_', ' ')) = ? OR UPPER(b.status) = ?)`;
      params.push(normStatus, status.toUpperCase());
    }

    if (technicianId) {
      baseSql += ` AND b.technician_id = ?`;
      params.push(Number(technicianId));
    }

    if (date) {
      baseSql += ` AND b.scheduled_date = ?`;
      params.push(date);
    }

    if (search) {
      baseSql += ` AND (
        b.booking_code LIKE ? OR
        b.customer_name LIKE ? OR
        b.phone LIKE ? OR
        b.service_name LIKE ? OR
        b.address LIKE ? OR
        b.city LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }

    const countRows = await query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = countRows[0]?.total || 0;

    const calcOffset = offset ? Number(offset) : Math.max(0, (Number(page) - 1) * Number(limit));
    const selectSql = `
      SELECT b.*, 
        t.name AS technician_name, 
        t.phone AS technician_phone,
        t.email AS technician_email,
        t.profile_image AS technician_profile_image,
        t.availability AS technician_availability
      ${baseSql}
      ORDER BY b.scheduled_date DESC, b.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, Number(limit), Number(calcOffset)];
    const rawRows = await query(selectSql, queryParams);
    const bookings = rawRows.map(formatBooking);

    return {
      bookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    };
  },

  async findById(id) {
    if (!id) return null;
    const isNum = Number.isInteger(Number(id)) && !String(id).includes('-');
    const whereSql = isNum ? 'b.id = ?' : 'b.booking_code = ?';
    const rows = await query(
      `SELECT b.*, 
        t.name AS technician_name, 
        t.phone AS technician_phone,
        t.email AS technician_email,
        t.profile_image AS technician_profile_image,
        t.availability AS technician_availability
       FROM bookings b
       LEFT JOIN technicians t ON b.technician_id = t.id
       WHERE ${whereSql}
       LIMIT 1`,
      [id]
    );
    return formatBooking(rows[0] || null);
  },

  async findByCode(code) {
    if (!code) return null;
    const rows = await query(
      `SELECT b.*, 
        t.name AS technician_name, 
        t.phone AS technician_phone,
        t.email AS technician_email,
        t.profile_image AS technician_profile_image,
        t.availability AS technician_availability
       FROM bookings b
       LEFT JOIN technicians t ON b.technician_id = t.id
       WHERE b.booking_code = ?
       LIMIT 1`,
      [code]
    );
    return formatBooking(rows[0] || null);
  },

  async create(data) {
    let bookingCode = data.booking_code || data.bookingCode;
    const year = new Date().getFullYear();

    // Generate cryptographically random, collision-safe reference if not explicitly supplied
    if (!bookingCode) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const randHex = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars: e.g. 7F3A2B1C
        const candidate = `UPC-${year}-${randHex}`;
        const existing = await query('SELECT id FROM bookings WHERE booking_code = ? LIMIT 1', [candidate]);
        if (!existing || existing.length === 0) {
          bookingCode = candidate;
          break;
        }
      }
      if (!bookingCode) {
        bookingCode = `UPC-${year}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      }
    }

    const sql = `
      INSERT INTO bookings (
        booking_code, lead_id, customer_id, service_id, technician_id,
        customer_name, phone, service_name, property_type,
        scheduled_date, time_slot, address, city, instructions, amount, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const initialStatus = (data.status ? String(data.status).toUpperCase() : 'PENDING');
    const params = [
      bookingCode,
      data.lead_id || data.leadId || null,
      data.customer_id || data.customerId || null,
      data.service_id || data.serviceId || null,
      data.technician_id || data.technicianId || null,
      data.name || data.customer_name || data.customerName || 'Customer',
      data.phone,
      data.service || data.service_name || data.serviceName || 'General Pest Control',
      data.property || data.property_type || data.propertyType || 'Residential',
      data.date || data.scheduled_date || data.scheduledDate || new Date().toISOString().split('T')[0],
      data.slot || data.time_slot || data.timeSlot || '10:00 AM - 12:00 PM',
      data.address || null,
      data.city || 'Pune',
      data.instructions || data.notes || null,
      data.amount !== undefined ? Number(data.amount) : 0.00,
      initialStatus,
      data.notes || data.instructions || null
    ];

    let result;
    try {
      result = await query(sql, params);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' && !data.booking_code && !data.bookingCode) {
        // Retry with a fresh cryptographically random booking reference on collision
        params[0] = `UPC-${year}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
        result = await query(sql, params);
      } else {
        throw err;
      }
    }
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    const fieldMap = {
      customer_name: data.customer_name || data.customerName || data.name,
      phone: data.phone,
      service_name: data.service_name || data.serviceName || data.service,
      service_id: data.service_id || data.serviceId,
      technician_id: data.technician_id !== undefined ? data.technician_id : data.technicianId,
      property_type: data.property_type || data.propertyType || data.property,
      scheduled_date: data.scheduled_date || data.scheduledDate || data.date,
      time_slot: data.time_slot || data.timeSlot || data.slot,
      address: data.address,
      city: data.city,
      instructions: data.instructions,
      amount: data.amount !== undefined ? Number(data.amount) : undefined,
      notes: data.notes
    };

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(val);
      }
    }

    // Status & milestone timestamps
    if (data.status) {
      const newStatus = String(data.status).toUpperCase();
      fields.push('`status` = ?');
      params.push(newStatus);

      if (newStatus === 'ASSIGNED') {
        fields.push('`assigned_at` = COALESCE(`assigned_at`, CURRENT_TIMESTAMP)');
      } else if (newStatus === 'ACCEPTED') {
        fields.push('`accepted_at` = COALESCE(`accepted_at`, CURRENT_TIMESTAMP)');
      } else if (newStatus === 'ON_THE_WAY') {
        fields.push('`on_the_way_at` = COALESCE(`on_the_way_at`, CURRENT_TIMESTAMP)');
      } else if (newStatus === 'ARRIVED') {
        fields.push('`arrived_at` = COALESCE(`arrived_at`, CURRENT_TIMESTAMP)');
      } else if (newStatus === 'IN_PROGRESS') {
        fields.push('`started_at` = COALESCE(`started_at`, CURRENT_TIMESTAMP)');
      } else if (newStatus === 'COMPLETED') {
        fields.push('`completed_at` = COALESCE(`completed_at`, CURRENT_TIMESTAMP)');
      } else if (newStatus === 'CANCELLED') {
        fields.push('`cancelled_at` = COALESCE(`cancelled_at`, CURRENT_TIMESTAMP)');
      }
    }

    if (fields.length === 0) return this.findById(id);

    const isNum = Number.isInteger(Number(id)) && !String(id).includes('-');
    const whereSql = isNum ? 'WHERE id = ?' : 'WHERE booking_code = ?';
    params.push(id);
    await query(`UPDATE bookings SET ${fields.join(', ')} ${whereSql}`, params);
    return this.findById(id);
  },

  async assignTechnician(id, technicianId) {
    const booking = await this.findById(id);
    if (!booking) return null;

    const techRows = await query(`SELECT * FROM technicians WHERE id = ? LIMIT 1`, [technicianId]);
    if (!techRows || techRows.length === 0) {
      throw new Error(`Technician with ID ${technicianId} not found.`);
    }

    const isNum = Number.isInteger(Number(id)) && !String(id).includes('-');
    const whereSql = isNum ? 'WHERE id = ?' : 'WHERE booking_code = ?';
    await query(
      `UPDATE bookings 
       SET technician_id = ?, status = 'ASSIGNED', assigned_at = CURRENT_TIMESTAMP 
       ${whereSql}`,
      [technicianId, id]
    );

    return this.findById(id);
  },

  async updateJobStatus(bookingId, status, notes = null) {
    const booking = await this.findById(bookingId);
    if (!booking) return null;

    const normalized = String(status).toUpperCase();
    const valid = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid job status: ${status}. Must be one of: ${valid.join(', ')}`);
    }

    const updates = ['status = ?'];
    const params = [normalized];

    if (notes) {
      updates.push('notes = CONCAT(COALESCE(notes, ""), "\n[", CURRENT_TIMESTAMP, " - Status: ", ?, "]: ", ?)');
      params.push(normalized, notes);
    }

    if (normalized === 'ASSIGNED') {
      updates.push('assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP)');
    } else if (normalized === 'ACCEPTED') {
      updates.push('accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)');
    } else if (normalized === 'ON_THE_WAY') {
      updates.push('on_the_way_at = COALESCE(on_the_way_at, CURRENT_TIMESTAMP)');
      if (booking.technicianId) {
        await query(`UPDATE technicians SET availability = 'ON_JOB' WHERE id = ?`, [booking.technicianId]);
      }
    } else if (normalized === 'ARRIVED') {
      updates.push('arrived_at = COALESCE(arrived_at, CURRENT_TIMESTAMP)');
      if (booking.technicianId) {
        await query(`UPDATE technicians SET availability = 'ON_JOB' WHERE id = ?`, [booking.technicianId]);
      }
    } else if (normalized === 'IN_PROGRESS') {
      updates.push('started_at = COALESCE(started_at, CURRENT_TIMESTAMP)');
      if (booking.technicianId) {
        await query(`UPDATE technicians SET availability = 'ON_JOB' WHERE id = ?`, [booking.technicianId]);
      }
    } else if (normalized === 'COMPLETED') {
      updates.push('completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)');
      if (booking.technicianId) {
        await query(
          `UPDATE technicians 
           SET jobs_completed = jobs_completed + 1, availability = 'AVAILABLE' 
           WHERE id = ?`,
          [booking.technicianId]
        );
      }
    } else if (normalized === 'CANCELLED') {
      updates.push('cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP)');
      if (booking.technicianId) {
        await query(`UPDATE technicians SET availability = 'AVAILABLE' WHERE id = ?`, [booking.technicianId]);
      }
    }

    const isNum = Number.isInteger(Number(bookingId)) && !String(bookingId).includes('-');
    const whereSql = isNum ? 'WHERE id = ?' : 'WHERE booking_code = ?';
    params.push(bookingId);
    await query(`UPDATE bookings SET ${updates.join(', ')} ${whereSql}`, params);

    return this.findById(bookingId);
  },

  async archive(id) {
    const isNum = Number.isInteger(Number(id)) && !String(id).includes('-');
    const whereSql = isNum ? 'WHERE id = ?' : 'WHERE booking_code = ?';
    await query(
      `UPDATE bookings SET is_archived = TRUE, status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP ${whereSql}`,
      [id]
    );
    return this.findById(id);
  },

  async getTrackingData(idOrCode) {
    if (!idOrCode) return null;
    const cleanQuery = String(idOrCode).trim();

    // Strictly disallow internal numeric IDs (e.g. 1, 2, 45) to prevent enumeration of internal records
    if (/^\d{1,8}$/.test(cleanQuery)) {
      return null;
    }

    // Check if query is a phone number (10+ digits) or a booking code
    const isPhoneQuery = /^\+?[0-9\s\-]{10,15}$/.test(cleanQuery);
    const normalizedPhone = cleanQuery.replace(/[\s\-\(\)]/g, '');

    let sql = `
      SELECT b.*,
        t.id AS tech_id,
        t.name AS technician_name, 
        t.profile_image AS technician_profile_image,
        t.skills AS technician_skills,
        t.rating AS technician_rating
       FROM bookings b
       LEFT JOIN technicians t ON b.technician_id = t.id
       WHERE b.booking_code = ?
    `;
    const params = [cleanQuery];

    if (isPhoneQuery) {
      sql += ` OR (b.phone = ? OR REPLACE(b.phone, ' ', '') = ? OR b.phone LIKE ?)`;
      params.push(cleanQuery, normalizedPhone, `%${normalizedPhone.slice(-10)}`);
    }

    sql += ` ORDER BY b.created_at DESC LIMIT 1`;

    let rows = await query(sql, params);

    if (rows.length === 0) return null;
    const b = rows[0];

    const currentStatus = (b.status || 'PENDING').toUpperCase();

    let technicianObj = null;
    if (b.technician_name) {
      let skillsArr = [];
      try {
        skillsArr = typeof b.technician_skills === 'string' ? JSON.parse(b.technician_skills) : b.technician_skills || [];
      } catch (e) {
        skillsArr = [];
      }
      technicianObj = {
        id: b.tech_id,
        name: b.technician_name,
        profileImage: b.technician_profile_image || 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=400&q=80',
        skills: Array.isArray(skillsArr) ? skillsArr : [],
        rating: Number(b.technician_rating || 4.9)
        // NOTE: technician phone and email strictly omitted to protect technician privacy
      };
    }

    // Prepare milestones matching Customer Status requirements:
    // Technician Assigned -> On The Way -> Arrived -> Service Started -> Completed
    const stages = [
      {
        key: 'CONFIRMED',
        label: 'Booking Confirmed',
        description: 'Service appointment locked with Universal Pest Control.',
        completed: true,
        active: currentStatus === 'CONFIRMED' || currentStatus === 'PENDING',
        timestamp: b.created_at
      },
      {
        key: 'ASSIGNED',
        label: 'Technician Assigned',
        description: technicianObj ? `${technicianObj.name} assigned to your service.` : 'Dispatching certified pest technician.',
        completed: Boolean(b.assigned_at || b.technician_id),
        active: currentStatus === 'ASSIGNED' || currentStatus === 'ACCEPTED',
        timestamp: b.assigned_at,
        technician: technicianObj
      },
      {
        key: 'ON_THE_WAY',
        label: 'On The Way',
        description: 'Technician is en route with professional treatment equipment.',
        completed: Boolean(b.on_the_way_at || ['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(currentStatus)),
        active: currentStatus === 'ON_THE_WAY',
        timestamp: b.on_the_way_at
      },
      {
        key: 'ARRIVED',
        label: 'Arrived at Location',
        description: 'Technician arrived at your premises for inspection and application.',
        completed: Boolean(b.arrived_at || ['ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(currentStatus)),
        active: currentStatus === 'ARRIVED',
        timestamp: b.arrived_at
      },
      {
        key: 'IN_PROGRESS',
        label: 'Service Started',
        description: 'Scientific odorless treatment in progress.',
        completed: Boolean(b.started_at || ['IN_PROGRESS', 'COMPLETED'].includes(currentStatus)),
        active: currentStatus === 'IN_PROGRESS',
        timestamp: b.started_at
      },
      {
        key: 'COMPLETED',
        label: 'Completed & Certified',
        description: 'Treatment successfully executed with digital warranty certificate.',
        completed: Boolean(b.completed_at || currentStatus === 'COMPLETED'),
        active: currentStatus === 'COMPLETED',
        timestamp: b.completed_at
      }
    ];

    return {
      bookingCode: b.booking_code,
      serviceName: b.service_name,
      propertyType: b.property_type,
      scheduledDate: b.scheduled_date,
      timeSlot: b.time_slot,
      city: b.city,
      currentStatus,
      technician: technicianObj,
      stages,
      amount: Number(b.amount || 0),
      isCancelled: currentStatus === 'CANCELLED'
      // NOTE: Customer phone and full street address strictly omitted to prevent unauthenticated PII leakage
    };
  }
};

module.exports = bookingModel;
