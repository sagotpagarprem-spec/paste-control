// Universal Pest Control — Technician Model (Phase 5)
const { query } = require('../config/database');

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (typeof val === 'string' && val.includes(',')) {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [String(val)];
  }
}

function formatTechnician(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    email: row.email || null,
    specialization: row.specialization || null,
    skills: parseJsonArray(row.skills),
    serviceAreas: parseJsonArray(row.service_areas),
    availability: (row.availability || 'AVAILABLE').toUpperCase(),
    status: (row.status || 'ACTIVE').toUpperCase(),
    profileImage: row.profile_image || 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=400&q=80',
    rating: Number(row.rating || 4.9),
    jobsCompleted: Number(row.jobs_completed || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const technicianModel = {
  async findAll({ search = '', status = '', availability = '', skill = '', area = '' } = {}) {
    let sql = `SELECT * FROM technicians WHERE 1=1`;
    const params = [];

    if (status && status !== 'ALL') {
      sql += ` AND UPPER(status) = ?`;
      params.push(status.toUpperCase());
    }

    if (availability && availability !== 'ALL') {
      sql += ` AND UPPER(availability) = ?`;
      params.push(availability.toUpperCase());
    }

    if (search) {
      sql += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR specialization LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY name ASC`;

    const rows = await query(sql, params);
    let results = rows.map(formatTechnician);

    if (skill) {
      const qSkill = skill.toLowerCase();
      results = results.filter((t) => t.skills.some((s) => s.toLowerCase().includes(qSkill)));
    }

    if (area) {
      const qArea = area.toLowerCase();
      results = results.filter((t) => t.serviceAreas.some((a) => a.toLowerCase().includes(qArea)));
    }

    return results;
  },

  async findById(id) {
    const rows = await query(`SELECT * FROM technicians WHERE id = ? LIMIT 1`, [id]);
    if (rows.length === 0) return null;

    const tech = formatTechnician(rows[0]);

    // Compute live stats
    const [counts] = await query(
      `SELECT 
        COUNT(CASE WHEN scheduled_date = CURDATE() AND status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 END) as today_jobs,
        COUNT(CASE WHEN status IN ('ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS') THEN 1 END) as active_jobs,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as total_completed
       FROM bookings 
       WHERE technician_id = ? AND is_archived = FALSE`,
      [id]
    );

    tech.todayJobsCount = Number(counts?.today_jobs || 0);
    tech.activeJobsCount = Number(counts?.active_jobs || 0);
    tech.totalCompletedCount = Number(counts?.total_completed || tech.jobsCompleted);

    return tech;
  },

  async create(data) {
    const skillsVal = data.skills
      ? (Array.isArray(data.skills) ? JSON.stringify(data.skills) : String(data.skills))
      : JSON.stringify([]);

    const areasVal = data.serviceAreas || data.service_areas
      ? (Array.isArray(data.serviceAreas || data.service_areas)
          ? JSON.stringify(data.serviceAreas || data.service_areas)
          : String(data.serviceAreas || data.service_areas))
      : JSON.stringify([]);

    const statusVal = (data.status || 'ACTIVE').toUpperCase();
    const availVal = (data.availability || 'AVAILABLE').toUpperCase();

    const result = await query(
      `INSERT INTO technicians (name, phone, email, specialization, skills, service_areas, availability, status, profile_image, rating, jobs_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.phone,
        data.email || null,
        data.specialization || (Array.isArray(data.skills) ? data.skills[0] : null),
        skillsVal,
        areasVal,
        availVal,
        statusVal,
        data.profileImage || data.profile_image || null,
        data.rating || 4.9,
        data.jobsCompleted || data.jobs_completed || 0
      ]
    );

    return this.findById(result.insertId);
  },

  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.phone !== undefined) {
      fields.push('phone = ?');
      params.push(data.phone);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      params.push(data.email);
    }
    if (data.specialization !== undefined) {
      fields.push('specialization = ?');
      params.push(data.specialization);
    }
    if (data.skills !== undefined) {
      fields.push('skills = ?');
      params.push(Array.isArray(data.skills) ? JSON.stringify(data.skills) : String(data.skills));
    }
    if (data.serviceAreas !== undefined || data.service_areas !== undefined) {
      const areas = data.serviceAreas !== undefined ? data.serviceAreas : data.service_areas;
      fields.push('service_areas = ?');
      params.push(Array.isArray(areas) ? JSON.stringify(areas) : String(areas));
    }
    if (data.availability !== undefined) {
      fields.push('availability = ?');
      params.push(String(data.availability).toUpperCase());
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(String(data.status).toUpperCase());
    }
    if (data.profileImage !== undefined || data.profile_image !== undefined) {
      fields.push('profile_image = ?');
      params.push(data.profileImage !== undefined ? data.profileImage : data.profile_image);
    }
    if (data.rating !== undefined) {
      fields.push('rating = ?');
      params.push(data.rating);
    }
    if (data.jobsCompleted !== undefined || data.jobs_completed !== undefined) {
      fields.push('jobs_completed = ?');
      params.push(data.jobsCompleted !== undefined ? data.jobsCompleted : data.jobs_completed);
    }

    if (fields.length > 0) {
      params.push(id);
      await query(`UPDATE technicians SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    return this.findById(id);
  },

  async updateStatus(id, status) {
    const valid = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
    const normalized = String(status).toUpperCase();
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${valid.join(', ')}`);
    }

    await query(`UPDATE technicians SET status = ? WHERE id = ?`, [normalized, id]);
    return this.findById(id);
  },

  async updateAvailability(id, availability) {
    const valid = ['AVAILABLE', 'ON_JOB', 'BUSY', 'OFF_DUTY'];
    const normalized = String(availability).toUpperCase();
    if (!valid.includes(normalized)) {
      throw new Error(`Invalid availability: ${availability}. Must be one of: ${valid.join(', ')}`);
    }

    await query(`UPDATE technicians SET availability = ? WHERE id = ?`, [normalized, id]);
    return this.findById(id);
  },

  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    // Soft delete/archive
    await query(`UPDATE technicians SET status = 'INACTIVE', availability = 'OFF_DUTY' WHERE id = ?`, [id]);
    return { success: true, message: 'Technician deactivated successfully.' };
  },

  async getJobs(id) {
    const tech = await this.findById(id);
    if (!tech) return null;

    const rows = await query(
      `SELECT b.*, s.name as service_title
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.technician_id = ? AND b.is_archived = FALSE
       ORDER BY b.scheduled_date ASC, b.time_slot ASC`,
      [id]
    );

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const today = [];
    const upcoming = [];
    const completed = [];

    rows.forEach((r) => {
      let schedDateStr = '';
      if (r.scheduled_date instanceof Date) {
        schedDateStr = r.scheduled_date.toISOString().split('T')[0];
      } else if (typeof r.scheduled_date === 'string') {
        schedDateStr = r.scheduled_date.split('T')[0];
      }

      const job = {
        id: r.id,
        bookingCode: r.booking_code,
        customerId: r.customer_id,
        leadId: r.lead_id,
        serviceId: r.service_id,
        customerName: r.customer_name,
        phone: r.phone,
        serviceName: r.service_name || r.service_title,
        propertyType: r.property_type,
        scheduledDate: schedDateStr,
        timeSlot: r.time_slot,
        address: r.address,
        city: r.city,
        instructions: r.instructions || '',
        amount: Number(r.amount || 0),
        status: (r.status || 'ASSIGNED').toUpperCase(),
        notes: r.notes || '',
        assignedAt: r.assigned_at,
        acceptedAt: r.accepted_at,
        onTheWayAt: r.on_the_way_at,
        arrivedAt: r.arrived_at,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        cancelledAt: r.cancelled_at,
        createdAt: r.created_at
      };

      if (job.status === 'COMPLETED') {
        completed.push(job);
      } else if (schedDateStr === todayStr) {
        today.push(job);
      } else if (schedDateStr > todayStr) {
        upcoming.push(job);
      } else {
        // Overdue pending job
        today.push(job);
      }
    });

    return {
      technician: tech,
      today,
      upcoming,
      completed,
      summary: {
        todayCount: today.length,
        upcomingCount: upcoming.length,
        completedCount: completed.length
      }
    };
  }
};

module.exports = technicianModel;
