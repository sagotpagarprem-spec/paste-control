// Universal Pest Control — Booking Model
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
    status: b.status,
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
      SELECT b.*, t.name AS technician_name, t.phone AS technician_phone
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
    const rows = await query(
      `SELECT b.*, t.name AS technician_name, t.phone AS technician_phone
       FROM bookings b
       LEFT JOIN technicians t ON b.technician_id = t.id
       WHERE b.id = ? OR b.booking_code = ?
       LIMIT 1`,
      [id, id]
    );
    return formatBooking(rows[0] || null);
  },

  async create(data) {
    const bookingCode = data.booking_code || data.bookingCode || `UPC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const sql = `
      INSERT INTO bookings (
        booking_code, lead_id, customer_id, service_id, technician_id,
        customer_name, phone, service_name, property_type,
        scheduled_date, time_slot, address, city, instructions, amount, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

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
      (data.status ? String(data.status).toUpperCase() : 'PENDING'),
      data.notes || data.instructions || null
    ];

    const result = await query(sql, params);
    return this.findById(result.insertId);
  },

  async update(id, data) {
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
      status: data.status ? String(data.status).toUpperCase() : undefined,
      notes: data.notes
    };

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(`\`${key}\` = ?`);
        params.push(val);
      }
    }

    if (fields.length === 0) return this.findById(id);

    params.push(id, id);
    await query(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ? OR booking_code = ?`, params);
    return this.findById(id);
  },

  async archive(id) {
    await query(`UPDATE bookings SET is_archived = TRUE, status = 'CANCELLED' WHERE id = ? OR booking_code = ?`, [id, id]);
    return this.findById(id);
  }
};

module.exports = bookingModel;
