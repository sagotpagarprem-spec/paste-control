// Universal Pest Control — Customer Model
const { query } = require('../config/database');
const crypto = require('crypto');

const customerModel = {
  async findAll({ search = '', limit = 50, offset = 0 } = {}) {
    let sql = `SELECT * FROM customers WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    return await query(sql, params);
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM customers WHERE id = ? OR uuid = ? LIMIT 1`, [id, id]);
    return rows[0] || null;
  },

  async findByPhone(phone) {
    const rows = await query(`SELECT * FROM customers WHERE phone = ? LIMIT 1`, [phone]);
    return rows[0] || null;
  },

  async create(data) {
    const uuid = crypto.randomUUID();
    const result = await query(
      `INSERT INTO customers (uuid, name, email, phone, property_type, address, city, area, pincode, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        data.name,
        data.email || null,
        data.phone,
        data.property_type || 'Residential',
        data.address || null,
        data.city || 'Pune',
        data.area || null,
        data.pincode || null,
        data.notes || null
      ]
    );
    return this.findById(result.insertId);
  }
};

module.exports = customerModel;
