// Universal Pest Control — Technician Model
const { query } = require('../config/database');

const technicianModel = {
  async findAll() {
    return await query(`SELECT * FROM technicians ORDER BY name ASC`);
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM technicians WHERE id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  },

  async updateStatus(id, status) {
    await query(`UPDATE technicians SET status = ? WHERE id = ?`, [status, id]);
    return this.findById(id);
  },

  async create(data) {
    const result = await query(
      `INSERT INTO technicians (name, phone, specialization, status, rating, jobs_completed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.phone,
        data.specialization || null,
        data.status || 'Available',
        data.rating || 4.9,
        data.jobs_completed || 0
      ]
    );
    return this.findById(result.insertId);
  }
};

module.exports = technicianModel;
