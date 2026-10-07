// Universal Pest Control — CMS Blog Model (Phase 4)
const { query } = require('../config/database');

function formatBlog(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    featuredImage: row.featured_image,
    category: row.category,
    author: row.author,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const blogModel = {
  async findAll({ status, publicOnly = false, category, search } = {}) {
    let sql = `SELECT * FROM blogs WHERE 1=1`;
    const params = [];

    if (publicOnly) {
      // Rule: Only published articles appear publicly
      sql += ` AND status = 'PUBLISHED'`;
    } else if (status && status !== 'ALL') {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (category && category !== 'All') {
      sql += ` AND category = ?`;
      params.push(category);
    }

    if (search) {
      sql += ` AND (title LIKE ? OR slug LIKE ? OR excerpt LIKE ? OR content LIKE ? OR author LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ` ORDER BY published_at DESC, id DESC`;
    const rows = await query(sql, params);
    return rows.map(formatBlog);
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM blogs WHERE id = ? OR slug = ? LIMIT 1`, [id, id]);
    return formatBlog(rows[0]);
  },

  async findBySlug(slug) {
    const rows = await query(`SELECT * FROM blogs WHERE slug = ? LIMIT 1`, [slug]);
    return formatBlog(rows[0]);
  },

  async create(data) {
    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const status = data.status || 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? (data.publishedAt || data.published_at || new Date()) : null;

    const result = await query(
      `INSERT INTO blogs (
        title, slug, excerpt, content, featured_image,
        category, author, seo_title, seo_description, status, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        slug,
        data.excerpt || null,
        data.content || '',
        data.featuredImage || data.featured_image || 'assets/images/hero.jpg',
        data.category || 'General',
        data.author || 'Universal Pest Specialist',
        data.seoTitle || data.seo_title || null,
        data.seoDescription || data.seo_description || null,
        status,
        publishedAt
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
    if (data.slug !== undefined) { fields.push('slug = ?'); params.push(data.slug); }
    if (data.excerpt !== undefined) { fields.push('excerpt = ?'); params.push(data.excerpt); }
    if (data.content !== undefined) { fields.push('content = ?'); params.push(data.content); }
    if (data.featuredImage !== undefined || data.featured_image !== undefined) {
      fields.push('featured_image = ?');
      params.push(data.featuredImage !== undefined ? data.featuredImage : data.featured_image);
    }
    if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category); }
    if (data.author !== undefined) { fields.push('author = ?'); params.push(data.author); }
    if (data.seoTitle !== undefined || data.seo_title !== undefined) {
      fields.push('seo_title = ?');
      params.push(data.seoTitle !== undefined ? data.seoTitle : data.seo_title);
    }
    if (data.seoDescription !== undefined || data.seo_description !== undefined) {
      fields.push('seo_description = ?');
      params.push(data.seoDescription !== undefined ? data.seoDescription : data.seo_description);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(data.status);

      if (data.status === 'PUBLISHED' && !existing.publishedAt) {
        fields.push('published_at = ?');
        params.push(new Date());
      }
    }
    if (data.publishedAt !== undefined || data.published_at !== undefined) {
      fields.push('published_at = ?');
      params.push(data.publishedAt !== undefined ? data.publishedAt : data.published_at);
    }

    if (fields.length === 0) return existing;

    params.push(id);
    await query(`UPDATE blogs SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    await query(`DELETE FROM blogs WHERE id = ?`, [id]);
    return { id, deleted: true };
  }
};

module.exports = blogModel;
