// Universal Pest Control — Database Migration & Seed Script
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');

async function runMigrationAndSeed() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'universal_pest_control';

  logger.info(`Starting migration connecting to MySQL at ${host}:${port} as ${user}...`);

  // Step 1: Connect without database to ensure database exists
  let initialConn;
  try {
    initialConn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
    await initialConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;`);
    await initialConn.end();
    logger.info(`Database '${database}' verified/created.`);
  } catch (err) {
    logger.error(`Failed to connect to MySQL server to check database: ${err.message}`);
    throw err;
  }

  // Step 2: Connect to the target database and run schema.sql
  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });

  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    logger.info('Executing database schema creation...');
    await conn.query(schemaSql);
    logger.info('Database schema tables created successfully.');

    // Step 3: Seed Roles
    const roles = [
      { name: 'admin', display_name: 'Administrator', description: 'Full system and platform access' },
      { name: 'manager', display_name: 'Operations Manager', description: 'Lead, booking, and technician management' },
      { name: 'technician', display_name: 'Field Technician', description: 'Job assignment and execution tracking' },
      { name: 'sales_agent', display_name: 'Sales Representative', description: 'Lead intake and follow-up' }
    ];

    for (const r of roles) {
      await conn.query(
        `INSERT INTO roles (name, display_name, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description)`,
        [r.name, r.display_name, r.description]
      );
    }

    // Step 4: Seed Permissions
    const permissions = [
      { name: 'leads:read', module: 'leads', description: 'View leads and pipeline' },
      { name: 'leads:create', module: 'leads', description: 'Create new inbound leads' },
      { name: 'leads:update', module: 'leads', description: 'Update lead status and notes' },
      { name: 'leads:delete', module: 'leads', description: 'Archive or delete leads' },
      { name: 'bookings:read', module: 'bookings', description: 'View service bookings' },
      { name: 'bookings:manage', module: 'bookings', description: 'Create and update bookings' },
      { name: 'customers:read', module: 'customers', description: 'View customer directory' },
      { name: 'customers:manage', module: 'customers', description: 'Manage customer accounts' },
      { name: 'technicians:read', module: 'technicians', description: 'View technician roster' },
      { name: 'technicians:manage', module: 'technicians', description: 'Assign and manage technicians' },
      { name: 'users:manage', module: 'users', description: 'Manage admin and staff users' },
      { name: 'settings:manage', module: 'settings', description: 'Update platform settings' },
      { name: 'audit:read', module: 'audit', description: 'View audit logs' }
    ];

    for (const p of permissions) {
      await conn.query(
        `INSERT INTO permissions (name, module, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [p.name, p.module, p.description]
      );
    }

    // Map all permissions to admin role
    const [adminRoleRows] = await conn.query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
    const adminRoleId = adminRoleRows[0]?.id;

    if (adminRoleId) {
      const [allPermRows] = await conn.query(`SELECT id FROM permissions`);
      for (const perm of allPermRows) {
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [adminRoleId, perm.id]
        );
      }
    }

    // Step 4.5: Ensure Phase 2 Columns on leads table
    const leadColumnsToAdd = [
      { name: 'address', def: 'TEXT NULL' },
      { name: 'message', def: 'TEXT NULL' },
      { name: 'utm_source', def: 'VARCHAR(100) NULL' },
      { name: 'utm_medium', def: 'VARCHAR(100) NULL' },
      { name: 'utm_campaign', def: 'VARCHAR(150) NULL' },
      { name: 'utm_content', def: 'VARCHAR(150) NULL' },
      { name: 'utm_term', def: 'VARCHAR(150) NULL' },
      { name: 'fbclid', def: 'VARCHAR(255) NULL' },
      { name: 'gclid', def: 'VARCHAR(255) NULL' },
      { name: 'landing_page', def: 'VARCHAR(500) NULL' },
      { name: 'referrer', def: 'VARCHAR(500) NULL' },
      { name: 'is_duplicate', def: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'duplicate_count', def: 'INT NOT NULL DEFAULT 0' },
      { name: 'duplicate_of_id', def: 'INT NULL' }
    ];

    for (const col of leadColumnsToAdd) {
      const [colExists] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leads' AND COLUMN_NAME = ?`,
        [database, col.name]
      );
      if (colExists.length === 0) {
        await conn.query(`ALTER TABLE leads ADD COLUMN \`${col.name}\` ${col.def}`);
        logger.info(`Added column ${col.name} to leads table.`);
      }
    }
    // Widen status column to VARCHAR(50) so all phase statuses are accepted
    try {
      await conn.query(`ALTER TABLE leads MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'NEW'`);
    } catch (e) {}

    // Step 5: Seed Default Admin & Sales Staff Users
    const staffMembers = [
      { name: 'Vikram Shinde', email: 'admin@universalpestcontrol.com', role: 'admin', phone: '+91 98230 44129' },
      { name: 'Pooja Patil', email: 'pooja@universalpestcontrol.com', role: 'sales_agent', phone: '+91 97654 22091' },
      { name: 'Amit Kulkarni', email: 'amit@universalpestcontrol.com', role: 'manager', phone: '+91 98901 88320' },
      { name: 'Rahul Shinde', email: 'rahul@universalpestcontrol.com', role: 'sales_agent', phone: '+91 99220 11984' }
    ];

    const defaultPasswordHash = await bcrypt.hash('Admin@1234', 10);

    for (const staff of staffMembers) {
      const [existingUser] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [staff.email]);
      let userId;
      if (existingUser.length === 0) {
        const [insertRes] = await conn.query(
          `INSERT INTO users (uuid, name, email, password_hash, phone, is_active)
           VALUES (?, ?, ?, ?, ?, TRUE)`,
          [crypto.randomUUID(), staff.name, staff.email, defaultPasswordHash, staff.phone]
        );
        userId = insertRes.insertId;
        logger.info(`Created staff user: ${staff.name} (${staff.email})`);
      } else {
        userId = existingUser[0].id;
      }

      const [roleRow] = await conn.query(`SELECT id FROM roles WHERE name = ? LIMIT 1`, [staff.role]);
      if (roleRow.length > 0 && userId) {
        await conn.query(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleRow[0].id]);
      }
    }

    // Step 6: Seed Services
    const services = [
      { slug: 'termite-control', name: 'Termite Control (Drill-Fill-Seal)', category: 'Structural', base_price: 14500.00, warranty_months: 60, duration_hours: 4.5, desc: 'Advanced sub-surface barrier protection with 5-year written warranty.' },
      { slug: 'commercial-pest-control', name: 'Commercial Pest AMC (HACCP/FSSAI)', category: 'Commercial', base_price: 28000.00, warranty_months: 12, duration_hours: 3.0, desc: 'Food-grade compliance pest management for hotels, kitchens, and warehouses.' },
      { slug: 'cockroach-control', name: 'German Cockroach Herbal Gel', category: 'Residential', base_price: 3200.00, warranty_months: 12, duration_hours: 1.5, desc: 'Odorless non-toxic micro-gel baiting with crack & crevice sealing.' },
      { slug: 'bed-bug-control', name: 'Bed Bug Thermal Steam & Cryo', category: 'Residential', base_price: 5800.00, warranty_months: 6, duration_hours: 3.0, desc: '2-visit elimination guarantee targeting eggs, nymphs, and adult harborages.' },
      { slug: 'rodent-control', name: 'Rodent Bait Station & Exclusion', category: 'General', base_price: 4500.00, warranty_months: 12, duration_hours: 2.0, desc: 'Tamper-resistant bait stations and sonic exclusion perimeter defense.' },
      { slug: 'mosquito-management', name: 'Mosquito Thermal Fogging & Larvicide', category: 'Outdoor', base_price: 3800.00, warranty_months: 3, duration_hours: 2.0, desc: 'Outdoor fogging and standing-water larvicidal barrier treatment.' }
    ];

    for (const s of services) {
      await conn.query(
        `INSERT INTO services (slug, name, category, base_price, warranty_months, duration_hours, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), base_price = VALUES(base_price)`,
        [s.slug, s.name, s.category, s.base_price, s.warranty_months, s.duration_hours, s.desc]
      );
    }

    // Step 7: Seed Technicians
    const technicians = [
      { name: 'Vikram Shinde', phone: '+91 98230 44129', spec: 'Termite & Structural Audit', status: 'Available', rating: 4.9, jobs: 420 },
      { name: 'Amit Kulkarni', phone: '+91 98901 88320', spec: 'Commercial HACCP Audit', status: 'Available', rating: 4.8, jobs: 310 },
      { name: 'Pooja Patil', phone: '+91 97654 22091', spec: 'Residential Herbal Gel', status: 'On Job', rating: 4.9, jobs: 285 },
      { name: 'Rahul Shinde', phone: '+91 99220 11984', spec: 'Thermal Bed Bug Specialist', status: 'Available', rating: 4.7, jobs: 195 }
    ];

    for (const t of technicians) {
      const [existingTech] = await conn.query(`SELECT id FROM technicians WHERE phone = ? LIMIT 1`, [t.phone]);
      if (existingTech.length === 0) {
        await conn.query(
          `INSERT INTO technicians (name, phone, specialization, status, rating, jobs_completed)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [t.name, t.phone, t.spec, t.status, t.rating, t.jobs]
        );
      }
    }

    // Step 8: Seed Initial Sample Leads
    const sampleLeads = [
      {
        code: 'LD-901',
        name: 'Dr. Rajiv Malhotra',
        phone: '+91 98230 44129',
        email: 'rajiv.malhotra@gmail.com',
        service: 'Termite Control',
        property: 'Villa (4 BHK)',
        city: 'Pune',
        area: 'Koregaon Park',
        source: 'Instagram Lead Ad',
        campaign: 'Termite Monsoon Shield 2026',
        adName: 'Reel_Infestation_Detection_v2',
        status: 'NEW',
        urgency: 'Today',
        value: 14500.00,
        notes: 'Customer observed hollow baseboards in study room and wooden cupboards.'
      },
      {
        code: 'LD-902',
        name: 'Chef Ananya Deshmukh',
        phone: '+91 98901 88320',
        email: 'kitchen@bistroolive.in',
        service: 'Commercial Pest Control',
        property: 'Restaurant (3,200 sq.ft)',
        city: 'Pune',
        area: 'Baner High Street',
        source: 'Google Ads',
        campaign: 'Commercial Kitchen HACCP Search',
        adName: 'Google_Search_RestaurantPest',
        status: 'SITE VISIT',
        urgency: 'Within 2–3 days',
        value: 28000.00,
        notes: 'Annual AMC contract required for FSSAI/HACCP hygiene audit clearance.'
      },
      {
        code: 'LD-903',
        name: 'Sameer Khandelwal',
        phone: '+91 97654 22091',
        email: 'sameer.k@tcs.com',
        service: 'Cockroach Control',
        property: 'Apartment (3 BHK)',
        city: 'Pune',
        area: 'Hinjawadi Phase 1',
        source: 'Website',
        campaign: 'Organic Search',
        adName: 'Organic Direct',
        status: 'CONTACTED',
        urgency: 'This week',
        value: 3200.00,
        notes: 'German cockroach infestation around modular kitchen chimney & sink drain.'
      },
      {
        code: 'LD-904',
        name: 'Priyanka Sen',
        phone: '+91 99220 11984',
        email: 'priyanka.sen@outlook.com',
        service: 'Bed Bug Control',
        property: 'Home (2 BHK)',
        city: 'Pune',
        area: 'Viman Nagar',
        source: 'Facebook Lead Ad',
        campaign: 'Bed Bug Steaming Solution',
        adName: 'FB_Story_SleepPeacefully',
        status: 'QUOTATION',
        urgency: 'Today',
        value: 5800.00,
        notes: 'Two master bedroom mattresses infested after international travel.'
      }
    ];

    for (const lead of sampleLeads) {
      const [existingLead] = await conn.query(`SELECT id FROM leads WHERE lead_code = ? LIMIT 1`, [lead.code]);
      let leadId;
      if (existingLead.length === 0) {
        const [insertLead] = await conn.query(
          `INSERT INTO leads (lead_code, name, phone, email, service_name, property_type, city, area, source, campaign, ad_name, status, urgency, estimated_value)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [lead.code, lead.name, lead.phone, lead.email, lead.service, lead.property, lead.city, lead.area, lead.source, lead.campaign, lead.adName, lead.status, lead.urgency, lead.value]
        );
        leadId = insertLead.insertId;

        if (lead.notes) {
          await conn.query(`INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)`, [leadId, lead.notes]);
        }
        await conn.query(
          `INSERT INTO lead_activities (lead_id, activity_type, description) VALUES (?, 'CREATED', CONCAT('Lead received via ', ?))`,
          [leadId, lead.source]
        );
      }
    }

    // Step 9: Seed Initial Bookings
    const sampleBookings = [
      {
        code: 'UPC-2026-8812',
        name: 'Dr. Rajiv Malhotra',
        phone: '+91 98230 44129',
        service: 'Termite Control (Drill-Fill-Seal)',
        property: 'Villa (4 BHK)',
        date: '2026-10-08',
        slot: '10:00 AM - 12:00 PM',
        address: 'Bungalow 14, Lane 7, Koregaon Park, Pune',
        amount: 14500.00,
        status: 'Confirmed'
      },
      {
        code: 'UPC-2026-8813',
        name: 'Bistro Olive (Chef Ananya)',
        phone: '+91 98901 88320',
        service: 'Commercial Pest AMC (Quarterly)',
        property: 'Restaurant (3,200 sq.ft)',
        date: '2026-10-09',
        slot: '02:00 PM - 04:00 PM',
        address: 'Level 2, High Street Hub, Baner, Pune',
        amount: 28000.00,
        status: 'Confirmed'
      }
    ];

    for (const b of sampleBookings) {
      await conn.query(
        `INSERT INTO bookings (booking_code, customer_name, phone, service_name, property_type, scheduled_date, time_slot, address, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [b.code, b.name, b.phone, b.service, b.property, b.date, b.slot, b.address, b.amount, b.status]
      );
    }

    // Step 10: Seed Initial Notifications
    const sampleNotifications = [
      { title: 'New High-Value Lead', message: 'Termite Villa inspection requested in Koregaon Park.', type: 'info' },
      { title: 'Commercial AMC Booking', message: 'Bistro Olive inspection confirmed for tomorrow.', type: 'success' },
      { title: 'Follow-up Due Reminder', message: '2 leads have follow-up schedules due today.', type: 'warning' }
    ];

    for (const notif of sampleNotifications) {
      await conn.query(
        `INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)`,
        [notif.title, notif.message, notif.type]
      );
    }

    logger.info('Database migration and seeding completed successfully!');
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  runMigrationAndSeed()
    .then(() => {
      console.log('Migration finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = runMigrationAndSeed;
