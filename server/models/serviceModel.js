// Universal Pest Control — Service Model
const { query } = require('../config/database');

const serviceModel = {
  async findAll({ activeOnly = true } = {}) {
    let sql = `SELECT * FROM services`;
    const params = [];
    if (activeOnly) {
      sql += ` WHERE is_active = TRUE`;
    }
    sql += ` ORDER BY name ASC`;
    return await query(sql, params);
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM services WHERE id = ? OR slug = ? LIMIT 1`, [id, id]);
    return rows[0] || null;
  },

  async create(data) {
    const result = await query(
      `INSERT INTO services (slug, name, category, description, base_price, warranty_months, duration_hours, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.slug,
        data.name,
        data.category || 'General',
        data.description || null,
        data.base_price || 0.00,
        data.warranty_months || 12,
        data.duration_hours || 2.0,
        data.is_active !== undefined ? data.is_active : true
      ]
    );
    return this.findById(result.insertId);
  }
};

module.exports = serviceModel;
