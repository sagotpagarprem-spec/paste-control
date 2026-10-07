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
      { name: 'cms:read', module: 'cms', description: 'View CMS content' },
      { name: 'cms:manage', module: 'cms', description: 'Create and update CMS content' },
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

    // Safe column migrations for bookings table
    const bookingColumnsToAdd = [
      { name: 'city', def: "VARCHAR(50) NOT NULL DEFAULT 'Pune'" },
      { name: 'instructions', def: 'TEXT NULL' },
      { name: 'is_archived', def: 'BOOLEAN NOT NULL DEFAULT FALSE' }
    ];

    for (const col of bookingColumnsToAdd) {
      const [colExists] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND COLUMN_NAME = ?`,
        [database, col.name]
      );
      if (colExists.length === 0) {
        await conn.query(`ALTER TABLE bookings ADD COLUMN \`${col.name}\` ${col.def}`);
        logger.info(`Added column ${col.name} to bookings table.`);
      }
    }
    // Widen bookings status column to VARCHAR(50)
    try {
      await conn.query(`ALTER TABLE bookings MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'`);
    } catch (e) {}

    // Ensure followups table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`followups\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`lead_id\` INT NOT NULL,
        \`assigned_to\` INT NULL,
        \`scheduled_date\` DATE NOT NULL,
        \`scheduled_time\` VARCHAR(20) NULL,
        \`notes\` TEXT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        \`completed_at\` TIMESTAMP NULL DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_followups_lead\` FOREIGN KEY (\`lead_id\`) REFERENCES \`leads\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_followups_user\` FOREIGN KEY (\`assigned_to\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_followups_status\` (\`status\`),
        INDEX \`idx_followups_date\` (\`scheduled_date\`),
        INDEX \`idx_followups_assigned\` (\`assigned_to\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure customer_reviews table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`customer_reviews\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`booking_id\` INT NULL,
        \`rating\` DECIMAL(2, 1) NOT NULL DEFAULT 5.0,
        \`review_text\` TEXT NULL,
        \`source\` VARCHAR(50) NOT NULL DEFAULT 'Direct',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_crev_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_crev_booking\` FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_crev_customer\` (\`customer_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure customer_notes table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`customer_notes\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer_id\` INT NOT NULL,
        \`user_id\` INT NULL,
        \`note\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_cnotes_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_cnotes_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_cnotes_customer\` (\`customer_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Step 4.7: Ensure Phase 4 Columns on services table
    const serviceColumnsToAdd = [
      { name: 'short_description', def: 'TEXT NULL' },
      { name: 'image', def: 'VARCHAR(255) NULL' },
      { name: 'price', def: 'DECIMAL(10, 2) NOT NULL DEFAULT 0.00' },
      { name: 'duration', def: "VARCHAR(100) NULL DEFAULT '2 Hours'" },
      { name: 'benefits', def: 'JSON NULL' },
      { name: 'process', def: 'JSON NULL' },
      { name: 'faq', def: 'JSON NULL' },
      { name: 'seo_title', def: 'VARCHAR(255) NULL' },
      { name: 'seo_description', def: 'TEXT NULL' },
      { name: 'status', def: "VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'" }
    ];

    for (const col of serviceColumnsToAdd) {
      const [colCheck] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'services' AND COLUMN_NAME = ?`,
        [database, col.name]
      );
      if (colCheck.length === 0) {
        await conn.query(`ALTER TABLE services ADD COLUMN \`${col.name}\` ${col.def}`);
        logger.info(`Added column ${col.name} to services table.`);
      }
    }

    // Ensure Phase 4 CMS tables exist
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`offers\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(150) NOT NULL,
        \`description\` TEXT NULL,
        \`service\` VARCHAR(100) NULL,
        \`service_id\` INT NULL,
        \`discount\` VARCHAR(50) NOT NULL,
        \`valid_from\` DATE NULL,
        \`valid_until\` DATE NULL,
        \`image\` VARCHAR(255) NULL,
        \`cta\` VARCHAR(100) NOT NULL DEFAULT 'Book Now',
        \`terms\` TEXT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_offers_service\` FOREIGN KEY (\`service_id\` ) REFERENCES \`services\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_offers_status\` (\`status\`),
        INDEX \`idx_offers_valid_until\` (\`valid_until\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`reviews\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`customer\` VARCHAR(100) NOT NULL,
        \`rating\` DECIMAL(2, 1) NOT NULL DEFAULT 5.0,
        \`review\` TEXT NOT NULL,
        \`service\` VARCHAR(100) NULL,
        \`location\` VARCHAR(150) NULL,
        \`image\` VARCHAR(255) NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        \`featured\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_reviews_status\` (\`status\`),
        INDEX \`idx_reviews_featured\` (\`featured\`),
        INDEX \`idx_reviews_rating\` (\`rating\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`blogs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`title\` VARCHAR(200) NOT NULL,
        \`slug\` VARCHAR(200) NOT NULL UNIQUE,
        \`excerpt\` TEXT NULL,
        \`content\` LONGTEXT NOT NULL,
        \`featured_image\` VARCHAR(255) NULL,
        \`category\` VARCHAR(100) NOT NULL DEFAULT 'General',
        \`author\` VARCHAR(100) NOT NULL DEFAULT 'Universal Pest Specialist',
        \`seo_title\` VARCHAR(255) NULL,
        \`seo_description\` TEXT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        \`published_at\` TIMESTAMP NULL DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_blogs_slug\` (\`slug\`),
        INDEX \`idx_blogs_status\` (\`status\`),
        INDEX \`idx_blogs_category\` (\`category\`),
        INDEX \`idx_blogs_published\` (\`published_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`service_areas\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`city\` VARCHAR(100) NOT NULL DEFAULT 'Pune',
        \`area\` VARCHAR(150) NOT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        \`service_availability\` TEXT NULL,
        \`seo_title\` VARCHAR(255) NULL,
        \`seo_description\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_areas_city\` (\`city\`),
        INDEX \`idx_areas_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

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

    // Step 6: Seed Rich Services (Phase 4 CMS)
    const services = [
      {
        slug: 'termite-control',
        name: 'Termite Radar Inspection & Barrier',
        category: 'Structural',
        price: 3999.00,
        base_price: 3999.00,
        warranty_months: 60,
        duration: '3 - 5 Hours',
        duration_hours: 4.5,
        image: 'assets/images/termite.jpg',
        shortDescription: 'Ultrasonic acoustic radar detection & drill-fill-seal non-repellent chemical barrier for foundational woodwork.',
        description: 'Advanced sub-surface barrier protection utilizing Bayer Premise non-repellent termiticide. Our acoustic radar maps subterranean colony tunnels without tile breaking, sealing access points for a guaranteed 5-year defense.',
        benefits: JSON.stringify([
          'Sub-surface acoustic radar scanning',
          'Non-destructive aesthetic hole sealing',
          '5-Year Government-backed written warranty',
          'Odorless, child and pet-safe formulation'
        ]),
        process: JSON.stringify([
          { step: '01', title: 'Ultrasonic Radar Detection', desc: 'Scan wall interiors and floorboards without breaking tiles.' },
          { step: '02', title: 'Drill-Fill-Seal Barrier', desc: 'Precision 12mm holes drilled at 45-degree angles at 1-foot intervals.' },
          { step: '03', title: 'Chemical Infiltration', desc: 'Pressurized injection of Bayer Premise termiticide.' },
          { step: '04', title: 'Invisible Aesthetic Sealing', desc: 'Holes sealed with color-matched wax chalk matching your flooring.' }
        ]),
        faq: JSON.stringify([
          { question: 'Will drilling damage our marble or wooden flooring?', answer: 'No. We use surgical 12mm diamond core drill bits and seal each injection point with specialized pigment-matched filler chalk.' },
          { question: 'Do we need to vacate our home during treatment?', answer: 'No. Our termiticides are completely odorless and non-volatile.' }
        ]),
        seoTitle: 'Termite Control Pune | Radar Detection & Drill-Fill-Seal Warranty',
        seoDescription: 'Eliminate termite colonies with non-destructive radar scanning and Bayer drill-fill-seal barrier. 5-Year warranty included.',
        status: 'ACTIVE'
      },
      {
        slug: 'cockroach-control',
        name: 'German Cockroach Odorless Gel',
        category: 'Residential',
        price: 1499.00,
        base_price: 1499.00,
        warranty_months: 12,
        duration: '45 - 60 Mins',
        duration_hours: 1.0,
        image: 'assets/images/hero.jpg',
        shortDescription: '100% odorless herbal & synthetic gel baiting. Zero need to empty kitchen cupboards or vacate.',
        description: 'Targeted German cockroach eradication utilizing micro-dot gel baiting inside cabinet hinges, electrical fixtures, and drain pipelines. Creates a Domino Effect that eliminates the entire colony within 72 hours.',
        benefits: JSON.stringify([
          'Bayer Maxforce Gel Technology',
          'No cupboard emptying or cleaning required',
          'Safe around infants, elderly, and pets',
          '1-Year Comprehensive Clearance Warranty'
        ]),
        process: JSON.stringify([
          { step: '01', title: 'Infestation Assessment', desc: 'Identify nesting hubs, moisture points, and cracks.' },
          { step: '02', title: 'Bayer Maxforce Gel Baiting', desc: 'Micro-dot application inside hinges, electrical points, and appliances.' },
          { step: '03', title: 'Drain Treatment', desc: 'Biological enzyme drain flush to eliminate breeding in pipelines.' },
          { step: '04', title: 'Preventive Barrier', desc: 'Residual perimeter spray along balcony and utility lines.' }
        ]),
        faq: JSON.stringify([
          { question: 'Do I need to wash utensils after gel treatment?', answer: 'No. The gel is applied in minute dots on non-food contact hinges and electrical points with zero airborne fumes.' }
        ]),
        seoTitle: 'Odorless Cockroach Pest Control Pune | Bayer Gel Technology',
        seoDescription: 'Get rid of cockroaches with 100% odorless gel treatment. Zero kitchen emptying required. Same-day service.',
        status: 'ACTIVE'
      },
      {
        slug: 'bed-bug-control',
        name: 'Bed Bug Thermal Steam & Cryo',
        category: 'Residential',
        price: 2499.00,
        base_price: 2499.00,
        warranty_months: 6,
        duration: '2 - 3 Hours',
        duration_hours: 2.5,
        image: 'assets/images/pantry_clean.jpg',
        shortDescription: '180°C superheated dry steam combined with micro-aerosol residual spray to eradicate adult bugs and eggs.',
        description: 'Two-stage scientific thermal steam eradication penetrating mattress seams, headboards, and sofa crevices. Followed by a 14-day free second visit to guarantee elimination of all emergent nymphs.',
        benefits: JSON.stringify([
          'High-pressure 180°C dry thermal steaming',
          'Kills nymphs, adults and eggs instantaneously',
          'Free 14-day secondary follow-up visit',
          'No mattress disposal needed'
        ]),
        process: JSON.stringify([
          { step: '01', title: 'Thermal Steam Disinfestation', desc: 'Superheated steam applied directly onto mattress seams and headboards.' },
          { step: '02', title: 'Deep Crack Infiltration', desc: 'Targeted aerosol injection into wooden joint seams and switchboards.' },
          { step: '03', title: 'Residual Barrier Layer', desc: 'Micro-encapsulated spray along baseboards.' },
          { step: '04', title: 'Day-14 Follow-up Clearance', desc: 'Second complimentary inspection to eradicate secondary egg hatches.' }
        ]),
        faq: JSON.stringify([
          { question: 'Will steam wet or damage our mattress?', answer: 'No. Superheated dry steam operates at high temperature with ultra-low moisture, drying within 20 minutes.' }
        ]),
        seoTitle: 'Bed Bug Treatment Pune | High Temp Thermal Steaming Guarantee',
        seoDescription: 'Destroy bed bugs and eggs with 180°C dry steam. Free 2nd visit warranty included.',
        status: 'ACTIVE'
      },
      {
        slug: 'commercial-pest-control',
        name: 'Commercial Pest AMC (HACCP/FSSAI)',
        category: 'Commercial',
        price: 4999.00,
        base_price: 4999.00,
        warranty_months: 12,
        duration: '3 - 4 Hours',
        duration_hours: 3.0,
        image: 'assets/images/commercial.jpg',
        shortDescription: 'Integrated Pest Management for restaurants, hotels, IT parks, and retail outlets with full audit compliance.',
        description: 'Complete compliance pest defense engineered for commercial facilities. Includes tamper-resistant bait stations, digital trend analysis logs, chemical safety MSDS records, and scheduled IPM visits.',
        benefits: JSON.stringify([
          'Zero business operational downtime',
          'Digital inspection trend reports & audit dossier',
          'Tamper-resistant bait stations & barcode scanning',
          'Full FSSAI, HACCP, and ISO 22000 compliance'
        ]),
        process: JSON.stringify([
          { step: '01', title: 'Facility Risk Assessment', desc: 'Mapping entry points, garbage chutes, and food prep areas.' },
          { step: '02', title: 'IPM Station Deployment', desc: 'Install numbered tamper-proof bait stations and insect light traps.' },
          { step: '03', title: 'Targeted Non-Food Treatment', desc: 'Eco-grade treatment after business closing hours.' },
          { step: '04', title: 'Digital Audit Certification', desc: 'Monthly audit report stamped for food safety authorities.' }
        ]),
        faq: JSON.stringify([
          { question: 'Do you provide audit certificates for food inspectors?', answer: 'Yes. Every client receives an official compliance audit folder with MSDS certificates and technician logs.' }
        ]),
        seoTitle: 'Commercial Pest Control Pune | FSSAI & HACCP Certified AMC',
        seoDescription: 'Enterprise pest control for restaurants, cafes, IT parks, and warehouses. Digital reporting & audits.',
        status: 'ACTIVE'
      },
      {
        slug: 'rodent-control',
        name: 'Rodent Bait Station & Sonic Exclusion',
        category: 'General',
        price: 2199.00,
        base_price: 2199.00,
        warranty_months: 12,
        duration: '1.5 - 2 Hours',
        duration_hours: 2.0,
        image: 'assets/images/hero.jpg',
        shortDescription: 'Tamper-resistant bait stations, physical entry point exclusion, and ultrasonic perimeter barriers.',
        description: 'Multi-tiered rodent management targeting roof rats, Norway rats, and field mice. Prevents wire gnawing, stock contamination, and pantry infestation with safe non-spill bait stations.',
        benefits: JSON.stringify([
          'Tamper-resistant lockable bait boxes',
          'Entry-hole wire mesh sealing',
          'Non-secondary poisoning safe rodenticides',
          'Odorless carcass recovery assistance'
        ]),
        process: JSON.stringify([
          { step: '01', title: 'Runway Mapping', desc: 'Identify grease marks, droppings, and entry burrows.' },
          { step: '02', title: 'Physical Exclusion', desc: 'Seal pipe gaps and door sweeps with steel wire mesh.' },
          { step: '03', title: 'Lockable Station Setup', desc: 'Position tamper-proof bait boxes along perimeter runways.' },
          { step: '04', title: 'Monitoring & Replenishment', desc: 'Scheduled inspections to verify total clearance.' }
        ]),
        faq: [
          { question: 'Will rodents die inside false ceilings?', answer: 'Our anticoagulant baits induce dehydration that instinctively drives rodents outdoors toward open air before demise.' }
        ],
        seoTitle: 'Rodent & Rat Pest Control Pune | Lockable Bait Stations',
        seoDescription: 'Stop rat and mouse infestations with professional exclusion and baiting systems.',
        status: 'ACTIVE'
      },
      {
        slug: 'mosquito-management',
        name: 'Mosquito Thermal Fogging & Larvicide',
        category: 'Outdoor',
        price: 1899.00,
        base_price: 1899.00,
        warranty_months: 3,
        duration: '1 - 2 Hours',
        duration_hours: 1.5,
        image: 'assets/images/hero.jpg',
        shortDescription: 'Outdoor thermal fogging and standing-water larvicidal barrier treatment for societies and gardens.',
        description: 'Comprehensive mosquito eradication targeting dengue, malaria, and chikungunya vectors. Employs cold ULV fogging and biological larvicide granules across garden drains and basements.',
        benefits: JSON.stringify([
          'Cold ULV and thermal fogging capabilities',
          'Biological larvicide prevents egg-to-pupa development',
          'Targets dengue & chikungunya mosquito species',
          'Society and housing colony discounts available'
        ]),
        process: JSON.stringify([
          { step: '01', title: 'Breeding Site Inspection', desc: 'Identify stagnant water pooling in flowerbeds and basement drains.' },
          { step: '02', title: 'Biological Larvicide Application', desc: 'Treat water bodies with eco-friendly larvicide granules.' },
          { step: '03', title: 'Perimeter Thermal Fogging', desc: 'Dense thermal fogging along shrubs, compound walls, and corridors.' }
        ]),
        faq: [
          { question: 'How long does mosquito fogging protection last?', answer: 'Larvicidal applications remain potent for 21-30 days against new breeding cycles.' }
        ],
        seoTitle: 'Mosquito Fogging Service Pune | Dengue Prevention Society AMC',
        seoDescription: 'Combat mosquitoes with safe thermal fogging and standing water larvicide treatment in Pune.',
        status: 'ACTIVE'
      }
    ];

    for (const s of services) {
      await conn.query(
        `INSERT INTO services (
          slug, name, category, price, base_price, warranty_months, duration, duration_hours,
          image, short_description, description, benefits, process, faq,
          seo_title, seo_description, status, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          category = VALUES(category),
          price = VALUES(price),
          base_price = VALUES(base_price),
          warranty_months = VALUES(warranty_months),
          duration = VALUES(duration),
          duration_hours = VALUES(duration_hours),
          image = VALUES(image),
          short_description = VALUES(short_description),
          description = VALUES(description),
          benefits = VALUES(benefits),
          process = VALUES(process),
          faq = VALUES(faq),
          seo_title = VALUES(seo_title),
          seo_description = VALUES(seo_description),
          status = VALUES(status),
          is_active = VALUES(is_active)`,
        [
          s.slug, s.name, s.category, s.price, s.base_price, s.warranty_months, s.duration, s.duration_hours,
          s.image, s.shortDescription, s.description,
          typeof s.benefits === 'string' ? s.benefits : JSON.stringify(s.benefits),
          typeof s.process === 'string' ? s.process : JSON.stringify(s.process),
          typeof s.faq === 'string' ? s.faq : JSON.stringify(s.faq),
          s.seoTitle, s.seoDescription, s.status, s.status === 'ACTIVE'
        ]
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
        code: 'UPC-2026-8941',
        name: 'Dr. Rajiv Malhotra',
        phone: '+91 98230 44129',
        service: 'Termite Radar Inspection & Barrier',
        property: 'Villa / Independent House',
        date: '2026-10-08',
        slot: '11:00 AM – 01:00 PM',
        address: 'Bungalow 14, Lane 7, Koregaon Park, Pune',
        city: 'Pune',
        amount: 14500.00,
        status: 'ASSIGNED',
        technician_id: 1,
        instructions: 'Gate bell on left pillar. Senior inspection technician requested.'
      },
      {
        code: 'UPC-2026-8942',
        name: 'Chef Ananya Deshmukh',
        phone: '+91 98901 88320',
        service: 'Commercial Kitchen & Cockroach Gel AMC',
        property: 'Commercial Office / Restaurant',
        date: '2026-10-08',
        slot: '03:00 PM – 05:00 PM',
        address: 'Level 2, High Street Hub, Baner, Pune',
        city: 'Pune',
        amount: 28000.00,
        status: 'CONFIRMED',
        technician_id: 2,
        instructions: 'Kitchen closure window between 3 PM and 5 PM.'
      },
      {
        code: 'UPC-2026-8943',
        name: 'Sanjay Deshpande',
        phone: '+91 98811 55221',
        service: 'Mosquito Fogging & Anti-Larval',
        property: 'Residential Apartment',
        date: '2026-10-09',
        slot: '09:00 AM – 11:00 AM',
        address: 'Flat 901, Marvel Bounty, Hadapsar, Pune',
        city: 'Pune',
        amount: 8500.00,
        status: 'PENDING',
        technician_id: null,
        instructions: 'Garden and balcony perimeter focus.'
      }
    ];

    for (const b of sampleBookings) {
      await conn.query(
        `INSERT INTO bookings (booking_code, customer_name, phone, service_name, property_type, scheduled_date, time_slot, address, city, amount, status, technician_id, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), technician_id = VALUES(technician_id), instructions = VALUES(instructions)`,
        [b.code, b.name, b.phone, b.service, b.property, b.date, b.slot, b.address, b.city, b.amount, b.status, b.technician_id, b.instructions]
      );
    }

    // Step 10: Seed Follow-ups (Overdue, Today, Upcoming)
    const [leadRows] = await conn.query(`SELECT id, lead_code FROM leads ORDER BY id ASC LIMIT 5`);
    if (leadRows.length > 0) {
      const todayDate = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const sampleFollowups = [
        {
          lead_id: leadRows[2]?.id || leadRows[0].id,
          assigned_to: 1,
          date: yesterdayDate,
          time: '11:00 AM',
          notes: 'German Cockroach Gel Quote clearance - check approval with building admin.',
          status: 'PENDING'
        },
        {
          lead_id: leadRows[0]?.id || leadRows[0].id,
          assigned_to: 1,
          date: todayDate,
          time: '11:30 AM',
          notes: 'Termite Radar Inspection Slot confirmation call.',
          status: 'PENDING'
        },
        {
          lead_id: leadRows[3]?.id || leadRows[0].id,
          assigned_to: 2,
          date: tomorrowDate,
          time: '02:00 PM',
          notes: 'Warehouse Bedbug Steaming contract renewal and quotation review.',
          status: 'PENDING'
        }
      ];

      for (const fu of sampleFollowups) {
        const [existingFu] = await conn.query(
          `SELECT id FROM followups WHERE lead_id = ? AND scheduled_date = ? LIMIT 1`,
          [fu.lead_id, fu.date]
        );
        if (existingFu.length === 0) {
          await conn.query(
            `INSERT INTO followups (lead_id, assigned_to, scheduled_date, scheduled_time, notes, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [fu.lead_id, fu.assigned_to, fu.date, fu.time, fu.notes, fu.status]
          );
        }
      }
    }

    // Step 11: Seed Initial Customer Reviews
    const [custRows] = await conn.query(`SELECT id FROM customers LIMIT 2`);
    if (custRows.length > 0) {
      for (const c of custRows) {
        const [existingRev] = await conn.query(`SELECT id FROM customer_reviews WHERE customer_id = ? LIMIT 1`, [c.id]);
        if (existingRev.length === 0) {
          await conn.query(
            `INSERT INTO customer_reviews (customer_id, rating, review_text, source)
             VALUES (?, 5.0, 'Exceptional termite treatment. Professional technicians and zero chemical odor.', 'Google Reviews')`,
            [c.id]
          );
        }
      }
    }

    // Step 12: Seed Initial Notifications with Required Types
    const sampleNotifications = [
      { title: 'New Lead Inbound', message: 'Termite Villa inspection requested in Koregaon Park.', type: 'NEW_LEAD' },
      { title: 'Follow-Up Due', message: 'German Cockroach quote clearance is due for follow-up today.', type: 'FOLLOWUP_DUE' },
      { title: 'Booking Confirmed', message: 'UPC-2026-8942 confirmed for Chef Ananya Deshmukh.', type: 'BOOKING_CONFIRMED' },
      { title: 'Technician Assigned', message: 'UPC-2026-8941 assigned to Senior Technician Vikram Shinde.', type: 'BOOKING_ASSIGNED' }
    ];

    for (const notif of sampleNotifications) {
      await conn.query(
        `INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)`,
        [notif.title, notif.message, notif.type]
      );
    }

    // Step 13: Seed Phase 4 Offers
    const sampleOffers = [
      {
        title: 'First Time Customer 20% Off',
        description: 'Exclusive welcome concession on all residential cockroach gel, bed bug steaming, and general pest treatments.',
        service: 'German Cockroach Odorless Gel',
        discount: '20% OFF',
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        image: 'assets/images/hero.jpg',
        cta: 'WELCOME20',
        terms: 'Applicable for residential properties only. One coupon per household.',
        status: 'ACTIVE'
      },
      {
        title: 'Free Termite Radar Inspection',
        description: 'Complimentary acoustic radar scan of all baseboards, door frames, and wooden fixtures worth ₹1,500.',
        service: 'Termite Radar Inspection & Barrier',
        discount: 'FREE INSPECTION',
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        image: 'assets/images/termite.jpg',
        cta: 'FREETEST',
        terms: 'Valid on properties within Pune metro service radius.',
        status: 'ACTIVE'
      },
      {
        title: 'Commercial Audit AMC 25% Off',
        description: 'Complete FSSAI documentation, 12 scheduled monthly inspections, and zero-downtime treatment.',
        service: 'Commercial Pest AMC (HACCP/FSSAI)',
        discount: '25% OFF AMC',
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        image: 'assets/images/commercial.jpg',
        cta: 'CORP25',
        terms: 'Minimum 1-year annual maintenance contract required for commercial kitchens or warehouses.',
        status: 'ACTIVE'
      },
      {
        title: 'Monsoon Mosquito Shield 15% Off',
        description: 'Dual thermal fogging and standing water larvicide treatment for housing societies and bungalows.',
        service: 'Mosquito Thermal Fogging & Larvicide',
        discount: '15% OFF',
        validFrom: '2026-06-01',
        validUntil: '2026-11-30',
        image: 'assets/images/hero.jpg',
        cta: 'MONSOON15',
        terms: 'Applicable for society compound areas up to 2 acres.',
        status: 'ACTIVE'
      }
    ];

    for (const o of sampleOffers) {
      const [existingOffer] = await conn.query(`SELECT id FROM offers WHERE cta = ? LIMIT 1`, [o.cta]);
      if (existingOffer.length === 0) {
        await conn.query(
          `INSERT INTO offers (title, description, service, discount, valid_from, valid_until, image, cta, terms, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [o.title, o.description, o.service, o.discount, o.validFrom, o.validUntil, o.image, o.cta, o.terms, o.status]
        );
      }
    }

    // Step 14: Seed Phase 4 CMS Reviews (Testimonials & Moderation)
    const sampleReviews = [
      {
        customer: 'Anjali Mehta',
        rating: 5.0,
        review: "We had severe German cockroaches in our modular kitchen drawers. Universal's team applied odorless gel in 40 minutes. We didn't even have to unpack groceries! Within 4 days, zero cockroaches. Highly recommend.",
        service: 'German Cockroach Odorless Gel',
        location: 'Kalyani Nagar, Pune • 3 BHK Apartment',
        image: 'AM',
        status: 'APPROVED',
        featured: true
      },
      {
        customer: 'Rohan Kulkarni',
        rating: 5.0,
        review: 'Our restaurant requires strict FSSAI and HACCP compliance. Universal Pest Control handles our monthly IPM audits and digital logging. The inspectors are impressed with their bait station mapping.',
        service: 'Commercial Pest AMC (HACCP/FSSAI)',
        location: 'Owner, Cafe Marz-o-Rin • Baner High St',
        image: 'RK',
        status: 'APPROVED',
        featured: true
      },
      {
        customer: 'Suresh Shah',
        rating: 5.0,
        review: 'Termites were destroying our Burma teak door frames. Their radar device detected underground tunnels without damaging anything. Drill-fill-seal was seamless and color-matched to perfection.',
        service: 'Termite Radar Inspection & Barrier',
        location: 'Aundh Villa, Pune • 5-Year Termite Warranty',
        image: 'SS',
        status: 'APPROVED',
        featured: true
      },
      {
        customer: 'Meera Deshmukh',
        rating: 4.8,
        review: 'High pressure thermal steam eradicated bed bugs completely from our master bed. The team gave us instructions on hot laundering and came back on day 14 for free follow-up clearance.',
        service: 'Bed Bug Thermal Steam & Cryo',
        location: 'Kothrud, Pune',
        image: 'MD',
        status: 'APPROVED',
        featured: false
      },
      {
        customer: 'Sameer Joshi',
        rating: 4.5,
        review: 'Polite technician who explained the rodent bait box mapping clearly. Good punctuality.',
        service: 'Rodent Bait Station & Sonic Exclusion',
        location: 'Wakad, Pune',
        image: 'SJ',
        status: 'PENDING',
        featured: false
      },
      {
        customer: 'Spam Bot Test Entry',
        rating: 1.0,
        review: 'Inappropriate commercial spam link detected in review submission.',
        service: 'General',
        location: 'Unknown',
        image: 'SB',
        status: 'REJECTED',
        featured: false
      }
    ];

    for (const r of sampleReviews) {
      const [existingRev] = await conn.query(`SELECT id FROM reviews WHERE customer = ? AND service = ? LIMIT 1`, [r.customer, r.service]);
      if (existingRev.length === 0) {
        await conn.query(
          `INSERT INTO reviews (customer, rating, review, service, location, image, status, featured)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.customer, r.rating, r.review, r.service, r.location, r.image, r.status, r.featured]
        );
      }
    }

    // Step 15: Seed Phase 4 CMS Blogs
    const sampleBlogs = [
      {
        title: 'How to Detect Subterranean Termites Before Wood Hollows',
        slug: 'how-to-detect-subterranean-termites',
        excerpt: 'Recognize the subtle acoustic signs, mud tubes along baseboards, and monsoon swarmers before structural woodwork is permanently destroyed.',
        content: `### Detecting Subterranean Termites Early

Subterranean termites (*Coptotermes gestroi*) cause hundreds of crores in property damage across India every year. Because they consume cellulose from the inside out, extensive architectural damage often remains invisible until door frames collapse or laminate veneers bubble.

#### Key Symptoms to Inspect:
1. **Acoustic Hollow Sounds**: Lightly tap baseboards and door casings with a knuckle or coin. A papery, hollow rattle indicates tunneling beneath the surface.
2. **Mud Tubes (Shelter Tubes)**: Termites require continuous humidity and build pencil-thick earthen tunnels across concrete walls, foundation slabs, and electrical conduits.
3. **Monsoon Swarmers (Alates)**: During the first heavy monsoon showers, winged reproductive termites emerge to mate. Piles of shed translucent wings near window ledges are a definitive alert.

#### Why Surface Chemical Spraying Fails
Surface insecticides merely kill foragers on contact, triggering the remaining colony to reroute deeper into your sub-floor foundation. Non-repellent termiticides (such as Imidacloprid) are undetectable to termites, allowing foragers to unwittingly transport the active compound directly to the queen.`,
        featuredImage: 'assets/images/termite.jpg',
        category: 'Termite Science',
        author: 'Dr. S. Rao (Entomologist)',
        seoTitle: 'How to Detect Termites Early | Pest Science Guide',
        seoDescription: 'Identify early termite infestation symptoms, acoustic detection methods, and scientific eradication techniques.',
        status: 'PUBLISHED',
        publishedAt: '2026-10-04 10:00:00'
      },
      {
        title: 'Why Store-Bought Sprays Fail Against German Cockroaches',
        slug: 'why-sprays-fail-against-cockroaches',
        excerpt: 'Commercial aerosol sprays act as repellents that scatter nests deeper into electrical conduits. Discover why non-repellent transfer gels deliver total colony collapse.',
        content: `### The Myth of Over-the-Counter Cockroach Sprays

Most homeowners reach for retail aerosol bug sprays the moment a German cockroach (*Blattella germanica*) scuttles across the kitchen counter. While the spray kills the single cockroach on contact, it exacerbates the broader infestation.

#### 1. Chemical Repellency & Nest Budding
Most aerosol insecticides contain fast-acting pyrethroids. These chemicals emit strong olfactory warnings to the colony. Rather than eliminating nests, sprays cause colonies to fragment ("bud") and flee into electrical sockets, microwave housings, and false ceilings.

#### 2. The Horizontal Transfer Domino Effect
Professional pest scientists utilize fipronil or indoxacarb micro-gel formulations. Cockroaches consume the irresistible gel bait, return to the harboring nest, and share the toxin through grooming and fecal consumption (coprophagy). This domino mechanism collapses up to 40 additional cockroaches per single feeding.`,
        featuredImage: 'assets/images/pantry_clean.jpg',
        category: 'Kitchen Hygiene',
        author: 'Vikram Shinde',
        seoTitle: 'Why Sprays Fail Against Cockroaches | Scientific Baiting Guide',
        seoDescription: 'Understand the biological behavior of German cockroaches and why micro-gel domino baiting outperforms aerosol sprays.',
        status: 'PUBLISHED',
        publishedAt: '2026-10-02 14:30:00'
      },
      {
        title: 'HACCP & FSSAI Pest Management Checklist for Commercial Kitchens',
        slug: 'haccp-fssai-pest-management-checklist',
        excerpt: 'Everything food safety officers and restaurant managers must document: bait station mapping, chemical MSDS safety certificates, and fly trap positioning.',
        content: `### Commercial Kitchen Pest Audit Readiness

Under FSSAI regulations and HACCP standard ISO 22000, any trace of pest harborage in a commercial food establishment triggers punitive audit findings and license suspension.

#### Core Audit Requirements:
- **Tamper-Resistant Perimeter Bait Stations**: Numbered, locked, anchored stations placed along exterior walls at 15-meter intervals.
- **Insect Light Trap (ILT) Calibration**: Shatterproof UV-A adhesive glue boards installed away from open preparation tables and direct daylight.
- **Digital Trend Reports**: Monthly catch rate counts analyzed to spot seasonal rodent or fly spikes before auditors arrive.
- **Chemical Safety Data Sheets (MSDS)**: On-demand documentation of food-grade approved odorless compounds.`,
        featuredImage: 'assets/images/commercial.jpg',
        category: 'B2B Compliance',
        author: 'Amit Kulkarni',
        seoTitle: 'HACCP Pest Control Checklist Pune | FSSAI Kitchen Audits',
        seoDescription: 'Comprehensive checklist for commercial food preparation facilities to achieve 100% compliance during safety audits.',
        status: 'PUBLISHED',
        publishedAt: '2026-09-28 09:15:00'
      },
      {
        title: 'Monsoon Pest Prevention Strategies for Societies and High-Rises',
        slug: 'monsoon-pest-prevention-strategies',
        excerpt: 'A comprehensive guide for society management committees on managing storm water drains, basement sumps, and shaft fumigation.',
        content: `### Preparing High-Rise Societies for Monsoon Invasions

Draft article detailing preventive measures for residential housing societies during heavy rainfall seasons...`,
        featuredImage: 'assets/images/hero.jpg',
        category: 'Society Management',
        author: 'Pooja Patil',
        seoTitle: 'Monsoon Pest Control for Societies | Drain & Sump Guide',
        seoDescription: 'Prevent monsoon mosquito, drain fly, and rodent surges in high-rise buildings and residential societies.',
        status: 'DRAFT',
        publishedAt: null
      }
    ];

    for (const b of sampleBlogs) {
      const [existingBlog] = await conn.query(`SELECT id FROM blogs WHERE slug = ? LIMIT 1`, [b.slug]);
      if (existingBlog.length === 0) {
        await conn.query(
          `INSERT INTO blogs (title, slug, excerpt, content, featured_image, category, author, seo_title, seo_description, status, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.title, b.slug, b.excerpt, b.content, b.featuredImage, b.category, b.author, b.seoTitle, b.seoDescription, b.status, b.publishedAt]
        );
      }
    }

    // Step 16: Seed Phase 4 Service Areas
    const sampleAreas = [
      {
        city: 'Pune',
        area: 'Baner & Balewadi (High Street, Pancard Club Rd)',
        status: 'ACTIVE',
        serviceAvailability: 'All Services (Termite, Cockroach, Bedbug, Commercial, Rodent, Mosquito)',
        seoTitle: 'Pest Control Baner & Balewadi Pune | Rapid 45-Min Arrival',
        seoDescription: 'Certified odorless pest control and termite inspection in Baner and Balewadi, Pune.'
      },
      {
        city: 'Pune',
        area: 'Hinjawadi Infotech Park (Phase 1, Phase 2, Phase 3)',
        status: 'ACTIVE',
        serviceAvailability: 'Commercial HACCP, Office IPM, Residential Gel',
        seoTitle: 'Pest Control Hinjawadi Pune | IT Park Office & Flat Disinfestation',
        seoDescription: 'Enterprise pest management and residential cockroach gel treatment across Hinjawadi Phase 1, 2, 3.'
      },
      {
        city: 'Pune',
        area: 'Wakad, Pimple Saudagar & Ravet',
        status: 'ACTIVE',
        serviceAvailability: 'Residential Odorless Gel, Bed Bug Steaming, Termite Drill-Fill-Seal',
        seoTitle: 'Pest Control Wakad & Pimple Saudagar | Top Rated Service',
        seoDescription: 'Eco-safe termite and pest treatment for apartments in Wakad and Pimple Saudagar.'
      },
      {
        city: 'Pune',
        area: 'Aundh, Pashan & Pune University',
        status: 'ACTIVE',
        serviceAvailability: 'All Services (Residential, Commercial, Villa Termite Radar)',
        seoTitle: 'Pest Control Aundh & Pashan Pune | 5-Year Warranty',
        seoDescription: 'Bayer certified termite protection and herbal pest control in Aundh and Pashan.'
      },
      {
        city: 'Pune',
        area: 'Koregaon Park (North & South Main Rd) & Kalyani Nagar',
        status: 'ACTIVE',
        serviceAvailability: 'All Services (Luxury Homes, Cafes, HACCP Audits)',
        seoTitle: 'Pest Control Koregaon Park & Kalyani Nagar Pune',
        seoDescription: 'Premium odorless pest management for luxury apartments and cafes in Koregaon Park.'
      },
      {
        city: 'Pune',
        area: 'Kharadi EON IT Free Zone & Viman Nagar',
        status: 'ACTIVE',
        serviceAvailability: 'Commercial Food Safety, Residential Herbal Gel, Mosquito Fogging',
        seoTitle: 'Pest Control Kharadi & Viman Nagar Pune | Near Airport',
        seoDescription: 'Specialized pest eradication for IT establishments and societies in Kharadi and Viman Nagar.'
      }
    ];

    for (const a of sampleAreas) {
      const [existingArea] = await conn.query(`SELECT id FROM service_areas WHERE city = ? AND area = ? LIMIT 1`, [a.city, a.area]);
      if (existingArea.length === 0) {
        await conn.query(
          `INSERT INTO service_areas (city, area, status, service_availability, seo_title, seo_description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [a.city, a.area, a.status, a.serviceAvailability, a.seoTitle, a.seoDescription]
        );
      }
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
