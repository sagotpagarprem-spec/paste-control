// Universal Pest Control — CMS Service Area Model (Phase 4)
const { query } = require('../config/database');

function formatArea(row) {
  if (!row) return null;
  return {
    id: row.id,
    city: row.city,
    area: row.area,
    status: row.status,
    serviceAvailability: row.service_availability,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const serviceAreaModel = {
  async findAll({ status, publicOnly = false, city, search } = {}) {
    let sql = `SELECT * FROM service_areas WHERE 1=1`;
    const params = [];

    if (publicOnly) {
      sql += ` AND status = 'ACTIVE'`;
    } else if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (city && city !== 'All') {
      sql += ` AND city = ?`;
      params.push(city);
    }

    if (search) {
      sql += ` AND (area LIKE ? OR city LIKE ? OR service_availability LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY city ASC, area ASC`;
    const rows = await query(sql, params);
    return rows.map(formatArea);
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM service_areas WHERE id = ? LIMIT 1`, [id]);
    return formatArea(rows[0]);
  },

  async create(data) {
    const result = await query(
      `INSERT INTO service_areas (city, area, status, service_availability, seo_title, seo_description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.city || 'Pune',
        data.area,
        data.status || 'ACTIVE',
        data.serviceAvailability || data.service_availability || 'All Services',
        data.seoTitle || data.seo_title || null,
        data.seoDescription || data.seo_description || null
      ]
    );

    return this.findById(result.insertId);
  },

  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    if (data.city !== undefined) { fields.push('city = ?'); params.push(data.city); }
    if (data.area !== undefined) { fields.push('area = ?'); params.push(data.area); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.serviceAvailability !== undefined || data.service_availability !== undefined) {
      fields.push('service_availability = ?');
      params.push(data.serviceAvailability !== undefined ? data.serviceAvailability : data.service_availability);
    }
    if (data.seoTitle !== undefined || data.seo_title !== undefined) {
      fields.push('seo_title = ?');
      params.push(data.seoTitle !== undefined ? data.seoTitle : data.seo_title);
    }
    if (data.seoDescription !== undefined || data.seo_description !== undefined) {
      fields.push('seo_description = ?');
      params.push(data.seoDescription !== undefined ? data.seoDescription : data.seo_description);
    }

    if (fields.length === 0) return existing;

    params.push(id);
    await query(`UPDATE service_areas SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    await query(`DELETE FROM service_areas WHERE id = ?`, [id]);
    return { id, deleted: true };
  }
};

module.exports = serviceAreaModel;
