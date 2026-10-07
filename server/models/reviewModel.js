// Universal Pest Control — CMS Review Model (Phase 4)
const { query } = require('../config/database');

function formatReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    customer: row.customer,
    rating: parseFloat(row.rating),
    review: row.review,
    service: row.service,
    location: row.location,
    image: row.image,
    status: row.status,
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const reviewModel = {
  async findAll({ status, publicOnly = false, featuredOnly = false, search } = {}) {
    let sql = `SELECT * FROM reviews WHERE 1=1`;
    const params = [];

    if (publicOnly) {
      // Rule: Only approved reviews appear publicly
      sql += ` AND status = 'APPROVED'`;
    } else if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (featuredOnly) {
      sql += ` AND featured = TRUE`;
    }

    if (search) {
      sql += ` AND (customer LIKE ? OR review LIKE ? OR service LIKE ? OR location LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY featured DESC, id DESC`;
    const rows = await query(sql, params);
    return rows.map(formatReview);
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM reviews WHERE id = ? LIMIT 1`, [id]);
    return formatReview(rows[0]);
  },

  async create(data) {
    const status = data.status || 'PENDING';
    const featured = Boolean(data.featured);
    const rating = Math.min(5, Math.max(1, parseFloat(data.rating || 5)));

    const result = await query(
      `INSERT INTO reviews (customer, rating, review, service, location, image, status, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.customer,
        rating,
        data.review,
        data.service || 'General Pest Control',
        data.location || 'Pune',
        data.image || null,
        status,
        featured
      ]
    );

    return this.findById(result.insertId);
  },

  async updateStatus(id, status) {
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    await query(`UPDATE reviews SET status = ? WHERE id = ?`, [status, id]);
    return this.findById(id);
  },

  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    if (data.customer !== undefined) { fields.push('customer = ?'); params.push(data.customer); }
    if (data.rating !== undefined) {
      fields.push('rating = ?');
      params.push(Math.min(5, Math.max(1, parseFloat(data.rating))));
    }
    if (data.review !== undefined) { fields.push('review = ?'); params.push(data.review); }
    if (data.service !== undefined) { fields.push('service = ?'); params.push(data.service); }
    if (data.location !== undefined) { fields.push('location = ?'); params.push(data.location); }
    if (data.image !== undefined) { fields.push('image = ?'); params.push(data.image); }
    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status); }
    if (data.featured !== undefined) { fields.push('featured = ?'); params.push(Boolean(data.featured)); }

    if (fields.length === 0) return existing;

    params.push(id);
    await query(`UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    await query(`DELETE FROM reviews WHERE id = ?`, [id]);
    return { id, deleted: true };
  }
};

module.exports = reviewModel;
