// Universal Pest Control — Booking Model
const { query } = require('../config/database');

const bookingModel = {
  async findAll({ status = '', limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT b.*, t.name AS technician_name, t.phone AS technician_phone
      FROM bookings b
      LEFT JOIN technicians t ON b.technician_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY b.scheduled_date DESC, b.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    return await query(sql, params);
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
    return rows[0] || null;
  },

  async create(data) {
    const bookingCode = data.booking_code || `UPC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const sql = `
      INSERT INTO bookings (
        booking_code, lead_id, customer_id, service_id, technician_id,
        customer_name, phone, service_name, property_type,
        scheduled_date, time_slot, address, amount, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      bookingCode,
      data.lead_id || null,
      data.customer_id || null,
      data.service_id || null,
      data.technician_id || null,
      data.name || data.customer_name || data.customerName,
      data.phone,
      data.service || data.service_name || 'Standard Treatment',
      data.property || data.property_type || 'Residential',
      data.date || data.scheduled_date,
      data.slot || data.time_slot || '10:00 AM - 12:00 PM',
      data.address || null,
      data.amount || 0.00,
      data.status || 'Confirmed',
      data.notes || null
    ];

    const result = await query(sql, params);
    return this.findById(result.insertId);
  },

  async updateStatus(id, status) {
    await query(`UPDATE bookings SET status = ? WHERE id = ? OR booking_code = ?`, [status, id, id]);
    return this.findById(id);
  }
};

module.exports = bookingModel;
