// Universal Pest Control — CMS Offer Model (Phase 4)
const { query } = require('../config/database');

function formatOffer(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    service: row.service,
    serviceId: row.service_id,
    discount: row.discount,
    validFrom: row.valid_from ? new Date(row.valid_from).toISOString().split('T')[0] : null,
    validUntil: row.valid_until ? new Date(row.valid_until).toISOString().split('T')[0] : null,
    image: row.image,
    cta: row.cta,
    terms: row.terms,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const offerModel = {
  async findAll({ activeOnly = false, status, search } = {}) {
    let sql = `SELECT * FROM offers WHERE 1=1`;
    const params = [];

    if (activeOnly) {
      sql += ` AND status = 'ACTIVE' AND (valid_until IS NULL OR valid_until >= CURDATE())`;
    } else if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (title LIKE ? OR cta LIKE ? OR service LIKE ? OR description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY id ASC`;
    const rows = await query(sql, params);
    return rows.map(formatOffer);
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM offers WHERE id = ? LIMIT 1`, [id]);
    return formatOffer(rows[0]);
  },

  async findByCta(cta) {
    const rows = await query(`SELECT * FROM offers WHERE cta = ? LIMIT 1`, [cta]);
    return formatOffer(rows[0]);
  },

  async create(data) {
    const result = await query(
      `INSERT INTO offers (
        title, description, service, service_id, discount,
        valid_from, valid_until, image, cta, terms, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.description || null,
        data.service || null,
        data.serviceId || data.service_id || null,
        data.discount || 'Special Discount',
        data.validFrom || data.valid_from || null,
        data.validUntil || data.valid_until || null,
        data.image || 'assets/images/hero.jpg',
        data.cta || 'CLAIM',
        data.terms || null,
        data.status || 'ACTIVE'
      ]
    );

    return this.findById(result.insertId);
  },

  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.service !== undefined) { fields.push('service = ?'); params.push(data.service); }
    if (data.serviceId !== undefined || data.service_id !== undefined) {
      fields.push('service_id = ?');
      params.push(data.serviceId !== undefined ? data.serviceId : data.service_id);
    }
    if (data.discount !== undefined) { fields.push('discount = ?'); params.push(data.discount); }
    if (data.validFrom !== undefined || data.valid_from !== undefined) {
      fields.push('valid_from = ?');
      params.push(data.validFrom !== undefined ? data.validFrom : data.valid_from);
    }
    if (data.validUntil !== undefined || data.valid_until !== undefined) {
      fields.push('valid_until = ?');
      params.push(data.validUntil !== undefined ? data.validUntil : data.valid_until);
    }
    if (data.image !== undefined) { fields.push('image = ?'); params.push(data.image); }
    if (data.cta !== undefined) { fields.push('cta = ?'); params.push(data.cta); }
    if (data.terms !== undefined) { fields.push('terms = ?'); params.push(data.terms); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }

    if (fields.length === 0) return existing;

    params.push(id);
    await query(`UPDATE offers SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    await query(`DELETE FROM offers WHERE id = ?`, [id]);
    return { id, deleted: true };
  }
};

module.exports = offerModel;
