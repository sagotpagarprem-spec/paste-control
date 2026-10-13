// Universal Pest Control — CMS Service Model (Phase 4)
const { query } = require('../config/database');

function parseJsonSafe(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function formatService(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description,
    shortDescription: row.short_description,
    image: row.image,
    price: parseFloat(row.price || row.base_price || 0),
    basePrice: parseFloat(row.base_price || row.price || 0),
    duration: row.duration || `${row.duration_hours || 2} Hours`,
    durationHours: parseFloat(row.duration_hours || 2),
    warrantyMonths: row.warranty_months,
    benefits: parseJsonSafe(row.benefits, []),
    process: parseJsonSafe(row.process, []),
    faq: parseJsonSafe(row.faq, []),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status || (row.is_active ? 'ACTIVE' : 'INACTIVE'),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const serviceModel = {
  async findAll({ activeOnly = false, category, status, search } = {}) {
    let sql = `SELECT * FROM services WHERE 1=1`;
    const params = [];

    if (activeOnly) {
      sql += ` AND (status = 'ACTIVE' OR (status IS NULL AND is_active = TRUE))`;
    } else if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }

    if (search) {
      sql += ` AND (name LIKE ? OR slug LIKE ? OR description LIKE ? OR short_description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY id ASC`;
    const rows = await query(sql, params);
    return rows.map(formatService);
  },

  async findById(id) {
    const rows = await query(
      `SELECT * FROM services WHERE id = ? OR slug = ? LIMIT 1`,
      [id, id]
    );
    return formatService(rows[0]);
  },

  async findBySlug(slug) {
    const rows = await query(`SELECT * FROM services WHERE slug = ? LIMIT 1`, [slug]);
    return formatService(rows[0]);
  },

  async findByNameOrId(nameOrId) {
    if (!nameOrId) return null;
    const isNum = Number.isInteger(Number(nameOrId)) && !String(nameOrId).includes('-');
    if (isNum) {
      const byId = await this.findById(Number(nameOrId));
      if (byId) return byId;
    }
    const rows = await query(
      `SELECT * FROM services WHERE id = ? OR slug = ? OR LOWER(name) = LOWER(?) LIMIT 1`,
      [nameOrId, nameOrId, String(nameOrId).trim()]
    );
    return formatService(rows[0] || null);
  },

  async create(data) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const price = data.price !== undefined ? parseFloat(data.price) : (data.base_price ? parseFloat(data.base_price) : 0);
    const duration = data.duration || (data.duration_hours ? `${data.duration_hours} Hours` : '2 Hours');
    const durationHours = data.durationHours || data.duration_hours || 2.0;
    const warrantyMonths = data.warrantyMonths || data.warranty_months || 12;
    const status = data.status || 'ACTIVE';
    const isActive = status === 'ACTIVE';

    const benefits = typeof data.benefits === 'object' ? JSON.stringify(data.benefits) : (data.benefits || null);
    const process = typeof data.process === 'object' ? JSON.stringify(data.process) : (data.process || null);
    const faq = typeof data.faq === 'object' ? JSON.stringify(data.faq) : (data.faq || null);

    const result = await query(
      `INSERT INTO services (
        slug, name, category, description, short_description, image,
        price, base_price, duration, duration_hours, warranty_months,
        benefits, process, faq, seo_title, seo_description, status, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        data.name,
        data.category || 'General',
        data.description || null,
        data.shortDescription || data.short_description || null,
        data.image || 'assets/images/hero.jpg',
        price,
        price,
        duration,
        durationHours,
        warrantyMonths,
        benefits,
        process,
        faq,
        data.seoTitle || data.seo_title || null,
        data.seoDescription || data.seo_description || null,
        status,
        isActive
      ]
    );

    return this.findById(result.insertId);
  },

  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.slug !== undefined) { fields.push('slug = ?'); params.push(data.slug); }
    if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.shortDescription !== undefined || data.short_description !== undefined) {
      fields.push('short_description = ?');
      params.push(data.shortDescription !== undefined ? data.shortDescription : data.short_description);
    }
    if (data.image !== undefined) { fields.push('image = ?'); params.push(data.image); }
    if (data.price !== undefined || data.base_price !== undefined) {
      const p = parseFloat(data.price !== undefined ? data.price : data.base_price);
      fields.push('price = ?', 'base_price = ?');
      params.push(p, p);
    }
    if (data.duration !== undefined) { fields.push('duration = ?'); params.push(data.duration); }
    if (data.durationHours !== undefined || data.duration_hours !== undefined) {
      fields.push('duration_hours = ?');
      params.push(parseFloat(data.durationHours !== undefined ? data.durationHours : data.duration_hours));
    }
    if (data.warrantyMonths !== undefined || data.warranty_months !== undefined) {
      fields.push('warranty_months = ?');
      params.push(parseInt(data.warrantyMonths !== undefined ? data.warrantyMonths : data.warranty_months, 10));
    }
    if (data.benefits !== undefined) {
      fields.push('benefits = ?');
      params.push(typeof data.benefits === 'object' ? JSON.stringify(data.benefits) : data.benefits);
    }
    if (data.process !== undefined) {
      fields.push('process = ?');
      params.push(typeof data.process === 'object' ? JSON.stringify(data.process) : data.process);
    }
    if (data.faq !== undefined) {
      fields.push('faq = ?');
      params.push(typeof data.faq === 'object' ? JSON.stringify(data.faq) : data.faq);
    }
    if (data.seoTitle !== undefined || data.seo_title !== undefined) {
      fields.push('seo_title = ?');
      params.push(data.seoTitle !== undefined ? data.seoTitle : data.seo_title);
    }
    if (data.seoDescription !== undefined || data.seo_description !== undefined) {
      fields.push('seo_description = ?');
      params.push(data.seoDescription !== undefined ? data.seoDescription : data.seo_description);
    }
    if (data.status !== undefined) {
      fields.push('status = ?', 'is_active = ?');
      params.push(data.status, data.status === 'ACTIVE');
    }

    if (fields.length === 0) return existing;

    params.push(existing.id);
    await query(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(existing.id);
  },

  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    // Soft delete/archive to preserve historical leads and bookings references
    await query(`UPDATE services SET status = 'ARCHIVED', is_active = FALSE WHERE id = ?`, [existing.id]);
    return { id: existing.id, status: 'ARCHIVED', archived: true };
  }
};

module.exports = serviceModel;
