// Universal Pest Control — Customer Model
const { query } = require('../config/database');
const crypto = require('crypto');

function formatCustomer(c) {
  if (!c) return null;
  return {
    ...c,
    id: c.id,
    uuid: c.uuid,
    name: c.name,
    email: c.email || null,
    phone: c.phone,
    propertyType: c.property_type,
    address: c.address || null,
    city: c.city || 'Pune',
    area: c.area || null,
    pincode: c.pincode || null,
    notes: c.notes || null,
    totalBookings: Number(c.total_bookings || 0),
    totalSpent: Number(c.total_spent || 0),
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}

const customerModel = {
  formatCustomer,

  async findAll({ search = '', city = '', page = 1, limit = 50, offset = 0 } = {}) {
    let baseSql = `
      FROM customers c
      LEFT JOIN bookings b ON b.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (city) {
      baseSql += ` AND c.city = ?`;
      params.push(city);
    }

    if (search) {
      baseSql += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.address LIKE ? OR c.city LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    // Total Count
    const countQuery = `SELECT COUNT(DISTINCT c.id) as total ${baseSql}`;
    const countRows = await query(countQuery, params);
    const total = countRows[0]?.total || 0;

    // Paginated Grouped Query
    const calcOffset = offset ? Number(offset) : Math.max(0, (Number(page) - 1) * Number(limit));
    const selectSql = `
      SELECT c.*,
             COUNT(DISTINCT b.id) AS total_bookings,
             COALESCE(SUM(b.amount), 0) AS total_spent,
             MAX(b.scheduled_date) AS last_booking_date
      ${baseSql}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, Number(limit), Number(calcOffset)];
    const rawRows = await query(selectSql, queryParams);
    const customers = rawRows.map(formatCustomer);

    return {
      customers,
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
    const sql = isNum
      ? `SELECT * FROM customers WHERE id = ? LIMIT 1`
      : `SELECT * FROM customers WHERE uuid = ? LIMIT 1`;
    const rows = await query(sql, [id]);
    if (rows.length === 0) return null;
    const customer = rows[0];

    // Fetch Bookings
    const bookings = await query(
      `SELECT b.id, b.booking_code, b.service_name, b.scheduled_date, b.time_slot, b.amount, b.status, b.created_at,
              t.name AS technician_name
       FROM bookings b
       LEFT JOIN technicians t ON b.technician_id = t.id
       WHERE b.customer_id = ? OR b.phone = ?
       ORDER BY b.scheduled_date DESC`,
      [customer.id, customer.phone]
    );

    // Fetch Lead History
    const leads = await query(
      `SELECT l.id, l.lead_code, l.service_name, l.property_type, l.source, l.campaign, l.status, l.estimated_value, l.created_at
       FROM leads l
       WHERE l.customer_id = ? OR l.phone = ?
       ORDER BY l.created_at DESC`,
      [customer.id, customer.phone]
    );

    // Fetch Customer Notes
    const customerNotes = await query(
      `SELECT cn.id, cn.note, cn.created_at, u.name AS author_name
       FROM customer_notes cn
       LEFT JOIN users u ON cn.user_id = u.id
       WHERE cn.customer_id = ?
       ORDER BY cn.created_at DESC`,
      [customer.id]
    );

    // Fetch Customer Reviews
    const reviews = await query(
      `SELECT cr.id, cr.rating, cr.review_text, cr.source, cr.created_at
       FROM customer_reviews cr
       WHERE cr.customer_id = ?
       ORDER BY cr.created_at DESC`,
      [customer.id]
    );

    // Distinct Services Summary
    const servicesSet = new Set();
    bookings.forEach(b => b.service_name && servicesSet.add(b.service_name));
    leads.forEach(l => l.service_name && servicesSet.add(l.service_name));
    const services = Array.from(servicesSet);

    // Calculate Totals
    const totalSpent = bookings.reduce((sum, b) => sum + Number(b.amount || 0), 0);

    return {
      ...formatCustomer(customer),
      services,
      bookings: bookings.map(b => ({
        id: b.id,
        bookingCode: b.booking_code,
        service: b.service_name,
        serviceName: b.service_name,
        date: b.scheduled_date,
        scheduledDate: b.scheduled_date,
        timeSlot: b.time_slot,
        amount: Number(b.amount || 0),
        status: b.status,
        technicianName: b.technician_name || null,
        createdAt: b.created_at
      })),
      leadHistory: leads.map(l => ({
        id: l.id,
        leadCode: l.lead_code,
        service: l.service_name,
        propertyType: l.property_type,
        source: l.source,
        campaign: l.campaign,
        status: l.status,
        estimatedValue: Number(l.estimated_value || 0),
        createdAt: l.created_at
      })),
      notes: customerNotes.map(n => ({
        id: n.id,
        note: n.note,
        authorName: n.author_name || 'Staff',
        createdAt: n.created_at
      })),
      reviews: reviews.map(r => ({
        id: r.id,
        rating: Number(r.rating),
        reviewText: r.review_text,
        source: r.source,
        createdAt: r.created_at
      })),
      stats: {
        totalBookings: bookings.length,
        totalLeads: leads.length,
        totalSpent,
        servicesCount: services.length
      }
    };
  },

  async findByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
    const rows = await query(
      `SELECT * FROM customers
       WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ?
       LIMIT 1`,
      [`%${cleanPhone.slice(-10)}%`]
    );
    return rows[0] || null;
  },

  async create(data) {
    const uuid = crypto.randomUUID();
    const result = await query(
      `INSERT INTO customers (uuid, name, email, phone, property_type, address, city, area, pincode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        data.name || 'Customer',
        data.email || null,
        data.phone,
        data.property_type || data.propertyType || 'Residential',
        data.address || null,
        data.city || 'Pune',
        data.area || null,
        data.pincode || null,
        data.notes || null
      ]
    );
    return this.findById(result.insertId);
  },

  async update(id, data) {
    const fields = [];
    const params = [];

    const fieldMap = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      property_type: data.property_type || data.propertyType,
      address: data.address,
      city: data.city,
      area: data.area,
      pincode: data.pincode,
      notes: data.notes
    };

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(val);
      }
    }

    if (fields.length === 0) return this.findById(id);

    const isNum = Number.isInteger(Number(id)) && !String(id).includes('-');
    const whereSql = isNum ? 'WHERE id = ?' : 'WHERE uuid = ?';
    params.push(id);
    await query(`UPDATE customers SET ${fields.join(', ')} ${whereSql}`, params);
    return this.findById(id);
  },

  /**
   * Automatically create or update customer when a qualified lead or booking is processed
   */
  async upsertFromLeadOrBooking(data) {
    const phone = data.phone ? data.phone.trim() : '';
    if (!phone) return null;

    let existing = await this.findByPhone(phone);
    if (!existing) {
      return await this.create({
        name: data.name || data.customer_name || data.customerName || 'Inbound Customer',
        phone,
        email: data.email || null,
        address: data.address || null,
        city: data.city || 'Pune',
        area: data.area || null,
        property_type: data.property_type || data.propertyType || 'Residential',
        notes: data.notes || data.message || null
      });
    }

    // Update empty fields on existing customer
    const updates = {};
    if (!existing.email && data.email) updates.email = data.email;
    if (!existing.address && data.address) updates.address = data.address;
    if ((!existing.city || existing.city === 'Pune') && data.city) updates.city = data.city;
    if (!existing.area && data.area) updates.area = data.area;
    if (data.name && (!existing.name || existing.name === 'Inbound Inquiry' || existing.name === 'Customer')) updates.name = data.name;

    if (Object.keys(updates).length > 0) {
      await this.update(existing.id, updates);
    }
    return this.findById(existing.id);
  },

  async addNote(customerId, note, userId = null) {
    await query(`INSERT INTO customer_notes (customer_id, user_id, note) VALUES (?, ?, ?)`, [customerId, userId, note]);
    return this.findById(customerId);
  },

  async addReview(customerId, { rating = 5.0, reviewText = '', source = 'Direct', bookingId = null } = {}) {
    await query(
      `INSERT INTO customer_reviews (customer_id, booking_id, rating, review_text, source) VALUES (?, ?, ?, ?, ?)`,
      [customerId, bookingId, rating, reviewText, source]
    );
    return this.findById(customerId);
  }
};

module.exports = customerModel;
