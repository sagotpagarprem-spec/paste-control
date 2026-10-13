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
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDemoSeed = !isProduction && process.env.SEED_DEMO_DATA === 'true';

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
      { name: 'meta:read', module: 'meta', description: 'View Meta connections and lead ads' },
      { name: 'meta:manage', module: 'meta', description: 'Manage Meta connection and ads' },
      { name: 'whatsapp:read', module: 'whatsapp', description: 'View WhatsApp chats and templates' },
      { name: 'whatsapp:manage', module: 'whatsapp', description: 'Send templates and manage WhatsApp' },
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

    // Step 4.2: Ensure user_sessions table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`user_sessions\` (
        \`id\` VARCHAR(128) PRIMARY KEY,
        \`user_id\` INT NOT NULL,
        \`token_hash\` VARCHAR(64) NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`user_agent\` TEXT NULL,
        \`expires_at\` TIMESTAMP NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_user_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_user_sessions_user\` (\`user_id\`),
        INDEX \`idx_user_sessions_expires\` (\`expires_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

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
      { name: 'platform', def: 'VARCHAR(50) NULL' },
      { name: 'campaign_id', def: 'VARCHAR(100) NULL' },
      { name: 'adset_name', def: 'VARCHAR(100) NULL' },
      { name: 'adset_id', def: 'VARCHAR(100) NULL' },
      { name: 'ad_id', def: 'VARCHAR(100) NULL' },
      { name: 'leadgen_id', def: 'VARCHAR(100) NULL' },
      { name: 'raw_meta_payload', def: 'JSON NULL' },
      { name: 'is_duplicate', def: 'BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'duplicate_count', def: 'INT NOT NULL DEFAULT 0' },
      { name: 'duplicate_of_id', def: 'INT NULL' },
      { name: 'preferred_date', def: 'DATE NULL' },
      { name: 'preferred_time', def: 'VARCHAR(50) NULL' },
      { name: 'admin_notes', def: 'TEXT NULL' },
      { name: 'assigned_technician_id', def: 'INT NULL' },
      { name: 'is_archived', def: 'BOOLEAN NOT NULL DEFAULT FALSE' }
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

    try {
      await conn.query(`ALTER TABLE leads ADD INDEX idx_leads_archived (is_archived)`);
    } catch (e) {}
    try {
      await conn.query(`ALTER TABLE leads ADD INDEX idx_leads_assigned_tech (assigned_technician_id)`);
    } catch (e) {}
    try {
      const [fkExists] = await conn.query(
        `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leads' AND CONSTRAINT_NAME = 'fk_leads_tech'`,
        [database]
      );
      if (fkExists.length === 0) {
        await conn.query(`ALTER TABLE leads ADD CONSTRAINT fk_leads_tech FOREIGN KEY (assigned_technician_id) REFERENCES technicians(id) ON DELETE SET NULL`);
      }
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

    // Ensure Phase 8 Meta Campaign Management tables and columns
    try {
      await conn.query(`ALTER TABLE meta_campaigns MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'`);
      await conn.query(`ALTER TABLE meta_ad_sets MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'`);
      await conn.query(`ALTER TABLE meta_creatives MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'`);
      await conn.query(`ALTER TABLE meta_ads MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'`);
    } catch (e) {}

    // Step 5: Seed Default Admin & Sales Staff Users
    // CRITICAL SECURITY: Never seed default passwords or create production admin accounts with hardcoded passwords!
    // Production admin accounts must be created using the secure CLI utility: npm run admin:create
    if (allowDemoSeed) {
      const demoPassword = process.env.DEMO_STAFF_PASSWORD;
      if (demoPassword) {
        logger.info('SEED_DEMO_DATA=true: Seeding demo staff accounts with configured DEMO_STAFF_PASSWORD...');
        const staffMembers = [
          { name: 'Vikram Shinde', email: 'admin@universalpestcontrol.com', role: 'admin', phone: '+91 98230 44129' },
          { name: 'Pooja Patil', email: 'pooja@universalpestcontrol.com', role: 'sales_agent', phone: '+91 97654 22091' },
          { name: 'Amit Kulkarni', email: 'amit@universalpestcontrol.com', role: 'manager', phone: '+91 98901 88320' },
          { name: 'Rahul Shinde', email: 'rahul@universalpestcontrol.com', role: 'sales_agent', phone: '+91 99220 11984' }
        ];

        const demoPasswordHash = await bcrypt.hash(demoPassword, 10);

        for (const staff of staffMembers) {
          const [existingUser] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [staff.email]);
          let userId;
          if (existingUser.length === 0) {
            const [insertRes] = await conn.query(
              `INSERT INTO users (uuid, name, email, password_hash, phone, is_active)
               VALUES (?, ?, ?, ?, ?, TRUE)`,
              [crypto.randomUUID(), staff.name, staff.email, demoPasswordHash, staff.phone]
            );
            userId = insertRes.insertId;
            logger.info(`Created demo staff user: ${staff.name} (${staff.email})`);
          } else {
            // NEVER reset existing account passwords during migrations!
            userId = existingUser[0].id;
          }

          const [roleRow] = await conn.query(`SELECT id FROM roles WHERE name = ? LIMIT 1`, [staff.role]);
          if (roleRow.length > 0 && userId) {
            await conn.query(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roleRow[0].id]);
          }
        }
      } else {
        logger.info('SEED_DEMO_DATA=true but DEMO_STAFF_PASSWORD not provided. Skipping demo staff creation.');
      }
    } else {
      logger.info('Skipping user seeding. Production migrations do not create accounts with default credentials.');
      logger.info('Use the secure CLI utility to initialize the administrator account: npm run admin:create');
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
      // Step 7 to 11: Demo Technicians, Leads, Bookings, Follow-ups, and Reviews
    if (allowDemoSeed) {
      logger.info('SEED_DEMO_DATA=true: Seeding sample technicians, leads, bookings, and follow-ups...');
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

      // Step 9: Seed Initial Bookings (Preserve existing bookings!)
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
          `INSERT IGNORE INTO bookings (booking_code, customer_name, phone, service_name, property_type, scheduled_date, time_slot, address, city, amount, status, technician_id, instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    } else {
      logger.info('Skipping demo technicians, leads, bookings, and follow-ups. Production migrations do not insert demo records.');
    }      }
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

    // Step 17: Phase 5 Technician & Dispatch System Migrations
    logger.info('Checking Phase 5 technician and booking dispatch columns...');

    // 17a. Technicians Table Columns
    const techColsToAdd = [
      { name: 'email', def: 'VARCHAR(150) NULL' },
      { name: 'skills', def: 'JSON NULL' },
      { name: 'service_areas', def: 'JSON NULL' },
      { name: 'availability', def: "VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE'" },
      { name: 'profile_image', def: 'VARCHAR(255) NULL' }
    ];

    for (const col of techColsToAdd) {
      try {
        const [exists] = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'technicians' AND COLUMN_NAME = ?`,
          [database, col.name]
        );
        if (exists.length === 0) {
          await conn.query(`ALTER TABLE \`technicians\` ADD COLUMN \`${col.name}\` ${col.def}`);
          logger.info(`Added column ${col.name} to technicians table.`);
        }
      } catch (err) {
        logger.warn(`Could not add column ${col.name} to technicians: ${err.message}`);
      }
    }

    // Safely widen/alter status on technicians from ENUM to VARCHAR(30)
    try {
      await conn.query(`ALTER TABLE \`technicians\` MODIFY COLUMN \`status\` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'`);
      // Normalize legacy statuses
      await conn.query(`UPDATE \`technicians\` SET \`availability\` = 'ON_JOB' WHERE \`status\` = 'On Job'`);
      await conn.query(`UPDATE \`technicians\` SET \`availability\` = 'OFF_DUTY' WHERE \`status\` = 'Off Duty'`);
      await conn.query(`UPDATE \`technicians\` SET \`status\` = 'ACTIVE' WHERE \`status\` IN ('Available', 'On Job', 'Off Duty')`);
    } catch (err) {
      logger.warn(`Could not modify technicians status column: ${err.message}`);
    }

    // 17b. Bookings Table Milestone Timestamps
    const bookingColsToAdd = [
      { name: 'assigned_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'accepted_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'on_the_way_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'arrived_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'started_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'completed_at', def: 'TIMESTAMP NULL DEFAULT NULL' },
      { name: 'cancelled_at', def: 'TIMESTAMP NULL DEFAULT NULL' }
    ];

    for (const col of bookingColsToAdd) {
      try {
        const [exists] = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings' AND COLUMN_NAME = ?`,
          [database, col.name]
        );
        if (exists.length === 0) {
          await conn.query(`ALTER TABLE \`bookings\` ADD COLUMN \`${col.name}\` ${col.def}`);
          logger.info(`Added milestone column ${col.name} to bookings table.`);
        }
      } catch (err) {
        logger.warn(`Could not add column ${col.name} to bookings: ${err.message}`);
      }
    }

    // 17c. Seed / Enrich Technicians
    if (allowDemoSeed) {
      logger.info('SEED_DEMO_DATA=true: Seeding and enriching sample technicians...');
      const sampleTechnicians = [
        {
          name: 'Vikram Shinde',
          phone: '+91 98230 44129',
          email: 'vikram.shinde@universalpest.in',
          skills: JSON.stringify(['Termite Radar Inspection', 'Pre-Construction Barrier', 'Wood Borer Drill-Fill']),
          serviceAreas: JSON.stringify(['Kothrud', 'Baner & Balewadi', 'Aundh & Pashan', 'Bavdhan']),
          availability: 'AVAILABLE',
          status: 'ACTIVE',
          profileImage: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=400&q=80',
          rating: 4.9,
          jobsCompleted: 420
        },
        {
          name: 'Amit Kulkarni',
          phone: '+91 98901 88320',
          email: 'amit.kulkarni@universalpest.in',
          skills: JSON.stringify(['Commercial HACCP Audit', 'Restaurant & Cafe IPM', 'German Cockroach Herbal Gel']),
          serviceAreas: JSON.stringify(['Koregaon Park & Kalyani Nagar', 'Kharadi EON', 'Viman Nagar', 'Magarpatta']),
          availability: 'AVAILABLE',
          status: 'ACTIVE',
          profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
          rating: 4.8,
          jobsCompleted: 310
        },
        {
          name: 'Pooja Patil',
          phone: '+91 97654 22091',
          email: 'pooja.patil@universalpest.in',
          skills: JSON.stringify(['Residential Herbal Gel', 'Pet & Child Safe Disinfection', 'Ant Nest Elimination']),
          serviceAreas: JSON.stringify(['Wakad & Pimple Saudagar', 'Hinjawadi Infotech Park', 'Ravet', 'Baner']),
          availability: 'ON_JOB',
          status: 'ACTIVE',
          profileImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
          rating: 4.9,
          jobsCompleted: 285
        },
        {
          name: 'Rahul Shinde',
          phone: '+91 99220 11984',
          email: 'rahul.shinde@universalpest.in',
          skills: JSON.stringify(['Thermal Bedbug Eradication', 'Cryo Heat Treatment', 'Steam Sanitization']),
          serviceAreas: JSON.stringify(['Shivajinagar', 'Deccan Gymkhana', 'Swargate', 'Kothrud']),
          availability: 'AVAILABLE',
          status: 'ACTIVE',
          profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
          rating: 4.7,
          jobsCompleted: 195
        },
        {
          name: 'Sachin Deshmukh',
          phone: '+91 98811 77203',
          email: 'sachin.deshmukh@universalpest.in',
          skills: JSON.stringify(['Rodent Bait Stations & Ultrasonic', 'Bird Netting & Spikes', 'Mosquito Fogging']),
          serviceAreas: JSON.stringify(['Hinjawadi Infotech Park', 'Wakad', 'Tathawade', 'Pimpri']),
          availability: 'OFF_DUTY',
          status: 'ON_LEAVE',
          profileImage: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
          rating: 4.8,
          jobsCompleted: 240
        }
      ];

      for (const t of sampleTechnicians) {
        const [existingTech] = await conn.query(`SELECT id FROM technicians WHERE phone = ? LIMIT 1`, [t.phone]);
        if (existingTech.length === 0) {
          await conn.query(
            `INSERT INTO technicians (name, phone, email, skills, service_areas, availability, status, profile_image, rating, jobs_completed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [t.name, t.phone, t.email, t.skills, t.serviceAreas, t.availability, t.status, t.profileImage, t.rating, t.jobsCompleted]
          );
        }
      }
    }

    // Step 18: Phase 6 WhatsApp Business Integration Migrations & Seeds
    logger.info('Checking Phase 6 WhatsApp Business tables and templates...');

    // 18a. Permissions
    const waPerms = [
      { name: 'whatsapp:read', module: 'whatsapp', description: 'View WhatsApp customer conversations and messages' },
      { name: 'whatsapp:manage', module: 'whatsapp', description: 'Send approved WhatsApp templates and replies' }
    ];

    for (const p of waPerms) {
      await conn.query(
        `INSERT INTO permissions (name, module, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [p.name, p.module, p.description]
      );
    }

    if (adminRoleId) {
      const [allPermRows] = await conn.query(`SELECT id FROM permissions WHERE name LIKE 'whatsapp:%'`);
      for (const perm of allPermRows) {
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [adminRoleId, perm.id]
        );
      }
    }

    // 18b. Ensure whatsapp_templates table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`whatsapp_templates\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL UNIQUE,
        \`category\` VARCHAR(50) NOT NULL DEFAULT 'UTILITY',
        \`language\` VARCHAR(10) NOT NULL DEFAULT 'en',
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
        \`header_text\` VARCHAR(255) NULL,
        \`body_text\` TEXT NOT NULL,
        \`footer_text\` VARCHAR(150) NULL,
        \`buttons\` JSON NULL,
        \`variables_sample\` JSON NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_wat_name\` (\`name\`),
        INDEX \`idx_wat_status\` (\`status\`),
        INDEX \`idx_wat_category\` (\`category\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 18c. Ensure whatsapp_messages table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`whatsapp_messages\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`wam_id\` VARCHAR(128) NULL UNIQUE,
        \`direction\` ENUM('OUTBOUND', 'INBOUND') NOT NULL DEFAULT 'OUTBOUND',
        \`to_phone\` VARCHAR(30) NOT NULL,
        \`from_phone\` VARCHAR(30) NOT NULL,
        \`customer_id\` INT NULL,
        \`lead_id\` INT NULL,
        \`booking_id\` INT NULL,
        \`template_name\` VARCHAR(100) NULL,
        \`template_language\` VARCHAR(10) DEFAULT 'en',
        \`message_type\` VARCHAR(30) NOT NULL DEFAULT 'TEMPLATE',
        \`body\` TEXT NOT NULL,
        \`status\` ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'QUEUED',
        \`error_message\` TEXT NULL,
        \`metadata\` JSON NULL,
        \`delivered_at\` TIMESTAMP NULL DEFAULT NULL,
        \`read_at\` TIMESTAMP NULL DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_wam_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_wam_lead\` FOREIGN KEY (\`lead_id\`) REFERENCES \`leads\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_wam_booking\` FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_wam_to_phone\` (\`to_phone\`),
        INDEX \`idx_wam_from_phone\` (\`from_phone\`),
        INDEX \`idx_wam_status\` (\`status\`),
        INDEX \`idx_wam_direction\` (\`direction\`),
        INDEX \`idx_wam_template\` (\`template_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 18d. Seed Official Approved WhatsApp Templates
    const approvedTemplates = [
      {
        name: 'lead_welcome_inspection',
        category: 'UTILITY',
        headerText: '🛡️ Universal Pest Control — Inquiry Received',
        bodyText: 'Hi {{1}}, thank you for contacting Universal Pest Control. We have received your inquiry for {{2}} in {{3}}. A certified senior specialist will call you shortly to confirm your free inspection slot. Reference: #{{4}}.',
        footerText: 'Certified Odorless & Child-Safe Pest Treatments',
        variablesSample: JSON.stringify(['Aakash', 'Termite Radar Inspection', 'Pune', 'LEAD-101']),
        buttons: JSON.stringify([
          { type: 'QUICK_REPLY', text: 'Confirm Slot' },
          { type: 'PHONE_NUMBER', text: 'Call Desk', phone_number: '+919823001122' }
        ])
      },
      {
        name: 'booking_confirmed_v1',
        category: 'UTILITY',
        headerText: '📋 Booking Confirmed — Universal Pest Control',
        bodyText: 'Hello {{1}}, your service booking #{{2}} for {{3}} is confirmed for {{4}} (Slot: {{5}}) at {{6}}. Our technician will arrive with sanitized equipment and digital audit kit.',
        footerText: 'Need to reschedule? Reply directly to this chat.',
        variablesSample: JSON.stringify(['Dr. Rajiv', 'UPC-2026-1001', 'Termite Barrier', 'Tomorrow', '11:00 AM - 01:00 PM', 'Koregaon Park']),
        buttons: JSON.stringify([
          { type: 'URL', text: 'Track Dispatch', url: 'https://universalpestcontrol.com/track' }
        ])
      },
      {
        name: 'technician_assigned_v1',
        category: 'UTILITY',
        headerText: '👷 Field Technician Dispatched',
        bodyText: 'Update for Booking #{{1}}: Certified technician {{2}} (📞 {{3}}) has been assigned to your service appointment scheduled for {{4}}. Real-time status: {{5}}.',
        footerText: 'GPS Route Activated • Masked & Sanitized Protocol',
        variablesSample: JSON.stringify(['UPC-2026-1001', 'Vikram Shinde', '+91 98230 44129', 'Today 11:00 AM', 'On The Way']),
        buttons: JSON.stringify([
          { type: 'PHONE_NUMBER', text: 'Call Technician', phone_number: '+919823044129' }
        ])
      },
      {
        name: 'service_completed_v1',
        category: 'UTILITY',
        headerText: '✅ Treatment Completed & Certified',
        bodyText: 'Hello {{1}}, your {{2}} treatment under Booking #{{3}} has been successfully completed and certified. Your scientific warranty certificate has been generated. Thank you for choosing Universal Pest Control!',
        footerText: 'Universal Pest Control — Pune Metro Care',
        variablesSample: JSON.stringify(['Dr. Rajiv', 'Termite Radar & Drill-Fill', 'UPC-2026-1001']),
        buttons: JSON.stringify([
          { type: 'QUICK_REPLY', text: 'Download Certificate' }
        ])
      },
      {
        name: 'review_request_v1',
        category: 'UTILITY',
        headerText: '⭐ Rate Your Pest Treatment Experience',
        bodyText: 'Hi {{1}}, we hope you loved the treatment provided by {{2}} today! How was your experience with Universal Pest Control? Please share your quick rating and review: {{3}}',
        footerText: 'Helps us maintain 4.9★ service standards.',
        variablesSample: JSON.stringify(['Dr. Rajiv', 'Vikram Shinde', 'https://universalpestcontrol.com/#reviews']),
        buttons: JSON.stringify([
          { type: 'URL', text: 'Leave Review', url: 'https://universalpestcontrol.com/#reviews' }
        ])
      },
      {
        name: 'followup_reminder_v1',
        category: 'UTILITY',
        headerText: '📅 Free Inspection Slot Reminder',
        bodyText: 'Hi {{1}}, this is a gentle reminder from Universal Pest Control regarding your scheduled pest assessment for {{2}}. Our expert is available today at {{3}}. Please reply YES to confirm or RESCHEDULE if you need another time.',
        footerText: 'Universal Pest Control Automated Scheduling',
        variablesSample: JSON.stringify(['Pooja', 'Cockroach Herbal Gel', '04:00 PM']),
        buttons: JSON.stringify([
          { type: 'QUICK_REPLY', text: 'YES Confirm' },
          { type: 'QUICK_REPLY', text: 'Reschedule' }
        ])
      }
    ];

    for (const tmpl of approvedTemplates) {
      await conn.query(
        `INSERT INTO whatsapp_templates (name, category, language, status, header_text, body_text, footer_text, buttons, variables_sample)
         VALUES (?, ?, 'en', 'APPROVED', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
          header_text = VALUES(header_text),
          body_text = VALUES(body_text),
          footer_text = VALUES(footer_text),
          buttons = VALUES(buttons),
          variables_sample = VALUES(variables_sample)`,
        [tmpl.name, tmpl.category, tmpl.headerText, tmpl.bodyText, tmpl.footerText, tmpl.buttons, tmpl.variablesSample]
      );
    }

    // 18e. Seed Sample Initial Conversations
    if (allowDemoSeed) {
      const sampleChatThreads = [
        {
          wamId: 'wamid.HBgMOTE5ODIzMDQ0MTI5FQIAERgSMzE4MjU3OTk4NDgzOTc3OTA5AA==',
          direction: 'OUTBOUND',
          toPhone: '+91 98230 44129',
          fromPhone: '+91 98230 01122',
          templateName: 'booking_confirmed_v1',
          body: 'Hello Dr. Rajiv Malhotra, your service booking #UPC-2026-1001 for Termite Control is confirmed for Today (Slot: 11:00 AM - 01:00 PM) at Koregaon Park. Our technician will arrive with sanitized equipment and digital audit kit.',
          status: 'READ',
          deliveredAt: new Date(Date.now() - 3600000),
          readAt: new Date(Date.now() - 3000000)
        },
        {
          wamId: 'wamid.HBgMOTE5ODIzMDQ0MTI5FQIAEhgUM0VBMDJEMkZGNTUxNzQ1OUFCMTMA',
          direction: 'INBOUND',
          toPhone: '+91 98230 01122',
          fromPhone: '+91 98230 44129',
          templateName: null,
          messageType: 'TEXT',
          body: 'Thank you! Please inform technician Vikram to ring the main doorbell twice, as our pet dog will be in the backyard.',
          status: 'DELIVERED',
          deliveredAt: new Date(Date.now() - 2800000),
          readAt: new Date(Date.now() - 2800000)
        },
        {
          wamId: 'wamid.HBgMOTE5ODkwMTg4MzIwFQIAERgSNTAzMjQ1NTE4OTAyMzQ1NjYwAA==',
          direction: 'OUTBOUND',
          toPhone: '+91 98901 88320',
          fromPhone: '+91 98230 01122',
          templateName: 'lead_welcome_inspection',
          body: 'Hi Chef Ananya, thank you for contacting Universal Pest Control. We have received your inquiry for Commercial Kitchen AMC in Baner High Street. A certified senior specialist will call you shortly to confirm your free inspection slot. Reference: #LEAD-204.',
          status: 'DELIVERED',
          deliveredAt: new Date(Date.now() - 7200000),
          readAt: null
        }
      ];

      for (const msg of sampleChatThreads) {
        const [existingMsg] = await conn.query(`SELECT id FROM whatsapp_messages WHERE wam_id = ? LIMIT 1`, [msg.wamId]);
        if (existingMsg.length === 0) {
          await conn.query(
            `INSERT INTO whatsapp_messages (wam_id, direction, to_phone, from_phone, template_name, message_type, body, status, delivered_at, read_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [msg.wamId, msg.direction, msg.toPhone, msg.fromPhone, msg.templateName, msg.messageType || 'TEMPLATE', msg.body, msg.status, msg.deliveredAt, msg.readAt]
          );
        }
      }
    }

    // Step 19: Phase 7 Meta (Facebook & Instagram) Lead Ads Integration Migrations & Seeds
    logger.info('Checking Phase 7 Meta Lead Ads tables and columns...');

    // 19a. Permissions
    const metaPerms = [
      { name: 'meta:read', module: 'meta', description: 'View Meta ad accounts, lead campaigns, and webhook logs' },
      { name: 'meta:manage', module: 'meta', description: 'Configure Meta connection, trigger sync, and retry webhook events' }
    ];

    for (const p of metaPerms) {
      await conn.query(
        `INSERT INTO permissions (name, module, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [p.name, p.module, p.description]
      );
    }

    if (adminRoleId) {
      const [allMetaPerms] = await conn.query(`SELECT id FROM permissions WHERE name LIKE 'meta:%'`);
      for (const perm of allMetaPerms) {
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [adminRoleId, perm.id]
        );
      }
    }

    // 19b. Alter leads table to support Meta Lead Ad fields if missing
    const metaLeadColumnsToAdd = [
      { name: 'campaign_id', def: 'VARCHAR(100) NULL AFTER campaign' },
      { name: 'adset_name', def: 'VARCHAR(150) NULL AFTER campaign_id' },
      { name: 'adset_id', def: 'VARCHAR(100) NULL AFTER adset_name' },
      { name: 'ad_id', def: 'VARCHAR(100) NULL AFTER ad_name' },
      { name: 'platform', def: 'VARCHAR(50) NULL AFTER source' },
      { name: 'leadgen_id', def: 'VARCHAR(100) NULL AFTER ad_id' },
      { name: 'raw_meta_payload', def: 'JSON NULL AFTER leadgen_id' }
    ];

    for (const col of metaLeadColumnsToAdd) {
      const [colCheck] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (colCheck.length === 0) {
        try {
          await conn.query(`ALTER TABLE \`leads\` ADD COLUMN \`${col.name}\` ${col.def}`);
          logger.info(`Added column ${col.name} to leads table.`);
        } catch (e) {
          // If placement fails, try appending
          await conn.query(`ALTER TABLE \`leads\` ADD COLUMN \`${col.name}\` ${col.def.replace(/AFTER\s+\w+/, '')}`);
        }
      }
    }

    // 19c. Ensure meta_configurations table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`meta_configurations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`account_name\` VARCHAR(150) NOT NULL DEFAULT 'Universal Pest Control Primary Meta Account',
        \`business_account_id\` VARCHAR(100) NULL,
        \`ad_account_id\` VARCHAR(100) NULL,
        \`page_id\` VARCHAR(100) NULL,
        \`page_name\` VARCHAR(150) NULL,
        \`instagram_actor_id\` VARCHAR(100) NULL,
        \`app_id\` VARCHAR(100) NULL,
        \`app_secret\` VARCHAR(255) NULL,
        \`access_token\` TEXT NULL,
        \`pixel_id\` VARCHAR(100) NULL,
        \`webhook_verify_token\` VARCHAR(150) NULL,
        \`status\` ENUM('CONNECTED', 'DISCONNECTED', 'PENDING', 'ERROR') DEFAULT 'CONNECTED',
        \`last_synced_at\` TIMESTAMP NULL DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_meta_status\` (\`status\`),
        INDEX \`idx_meta_page\` (\`page_id\`),
        INDEX \`idx_meta_ad_account\` (\`ad_account_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 19d. Ensure meta_lead_events table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`meta_lead_events\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_id\` VARCHAR(128) NOT NULL UNIQUE,
        \`leadgen_id\` VARCHAR(100) NOT NULL,
        \`page_id\` VARCHAR(100) NULL,
        \`form_id\` VARCHAR(100) NULL,
        \`adgroup_id\` VARCHAR(100) NULL,
        \`ad_id\` VARCHAR(100) NULL,
        \`platform\` VARCHAR(50) NULL,
        \`status\` ENUM('RECEIVED', 'PROCESSED', 'FAILED', 'RETRYING') DEFAULT 'RECEIVED',
        \`lead_id\` INT NULL,
        \`payload\` JSON NOT NULL,
        \`error_message\` TEXT NULL,
        \`retry_count\` INT NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_mle_lead\` FOREIGN KEY (\`lead_id\`) REFERENCES \`leads\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_mle_leadgen\` (\`leadgen_id\`),
        INDEX \`idx_mle_status\` (\`status\`),
        INDEX \`idx_mle_platform\` (\`platform\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 19e. Seed default active Meta configuration
    const [existingMetaConfig] = await conn.query(`SELECT id FROM meta_configurations LIMIT 1`);
    if (existingMetaConfig.length === 0) {
      await conn.query(`
        INSERT INTO meta_configurations (
          account_name, business_account_id, ad_account_id, page_id, page_name,
          instagram_actor_id, app_id, app_secret, access_token, pixel_id, webhook_verify_token, status, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONNECTED', CURRENT_TIMESTAMP)
      `, [
        'Universal Pest Control — Meta Ads Portfolio',
        'act_83921049281',
        'act_83921049281',
        '109283746501928',
        'Universal Pest Control Official',
        '17841405928193821',
        '928374650192837',
        'upc_sec_app_secret_hash_2026',
        'EAAGMockUniversalPestControlMetaTokenSecret2026',
        '987654321012345',
        'upc_meta_webhook_verify_token_2026'
      ]);
      logger.info('Seeded default Meta ad account configuration.');
    }

    // Step 20: Phase 8, 9, 10 Meta Campaigns, AI Creative Studio & Analytics Migrations
    logger.info('Checking Phase 8-10 tables (Meta Campaigns, AI Creatives, Analytics)...');

    // 20a. Permissions
    const phase8to10Perms = [
      { name: 'campaigns:read', module: 'campaigns', description: 'View Meta ad campaigns, ad sets, ads, and performance' },
      { name: 'campaigns:manage', module: 'campaigns', description: 'Create, edit, review, and publish campaigns and ad sets' },
      { name: 'creatives:generate', module: 'creatives', description: 'Generate AI creative copy, concepts, and scripts' },
      { name: 'analytics:read', module: 'analytics', description: 'View website traffic, conversion funnels, and attribution reports' }
    ];

    for (const p of phase8to10Perms) {
      await conn.query(
        `INSERT INTO permissions (name, module, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [p.name, p.module, p.description]
      );
    }

    if (adminRoleId) {
      const [allNewPerms] = await conn.query(`SELECT id FROM permissions WHERE module IN ('campaigns', 'creatives', 'analytics')`);
      for (const perm of allNewPerms) {
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [adminRoleId, perm.id]
        );
      }
    }

    // 20b. Ensure meta_campaigns table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`meta_campaigns\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`campaign_id\` VARCHAR(100) NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`objective\` VARCHAR(50) NOT NULL DEFAULT 'OUTCOME_LEADS',
        \`status\` ENUM('DRAFT', 'REVIEW', 'READY', 'PUBLISHED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        \`daily_budget\` DECIMAL(12, 2) NULL,
        \`lifetime_budget\` DECIMAL(12, 2) NULL,
        \`start_time\` TIMESTAMP NULL DEFAULT NULL,
        \`end_time\` TIMESTAMP NULL DEFAULT NULL,
        \`location\` VARCHAR(255) DEFAULT 'Pune, Maharashtra',
        \`target_audience\` JSON NULL,
        \`spend\` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        \`impressions\` INT NOT NULL DEFAULT 0,
        \`clicks\` INT NOT NULL DEFAULT 0,
        \`leads\` INT NOT NULL DEFAULT 0,
        \`cpl\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`conversions\` INT NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_mc_status\` (\`status\`),
        INDEX \`idx_mc_objective\` (\`objective\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20c. Ensure meta_ad_sets table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`meta_ad_sets\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`campaign_id\` INT NOT NULL,
        \`adset_id\` VARCHAR(100) NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`status\` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        \`billing_event\` VARCHAR(50) DEFAULT 'IMPRESSIONS',
        \`optimization_goal\` VARCHAR(50) DEFAULT 'LEAD_GENERATION',
        \`targeting\` JSON NULL,
        \`budget\` DECIMAL(12, 2) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_mas_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`meta_campaigns\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_mas_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20d. Ensure meta_creatives table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`meta_creatives\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`creative_id\` VARCHAR(100) NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`image_url\` VARCHAR(500) NULL,
        \`video_url\` VARCHAR(500) NULL,
        \`headline\` VARCHAR(255) NOT NULL,
        \`primary_text\` TEXT NOT NULL,
        \`description\` TEXT NULL,
        \`cta\` VARCHAR(50) NOT NULL DEFAULT 'GET_QUOTE',
        \`destination_url\` VARCHAR(500) NULL,
        \`instagram_story_spec\` JSON NULL,
        \`ai_generated\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`status\` ENUM('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_mcr_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20e. Ensure meta_ads table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`meta_ads\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`adset_id\` INT NOT NULL,
        \`ad_id\` VARCHAR(100) NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`creative_id\` INT NULL,
        \`status\` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_ma_adset\` FOREIGN KEY (\`adset_id\` ) REFERENCES \`meta_ad_sets\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_ma_creative\` FOREIGN KEY (\`creative_id\`) REFERENCES \`meta_creatives\` (\`id\`) ON DELETE SET NULL,
        INDEX \`idx_ma_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20f. Ensure ai_creative_generations table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`ai_creative_generations\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`service\` VARCHAR(100) NOT NULL,
        \`location\` VARCHAR(100) NOT NULL DEFAULT 'Pune',
        \`audience\` VARCHAR(100) NOT NULL DEFAULT 'Homeowners & Societies',
        \`offer\` VARCHAR(150) NULL DEFAULT 'Flat ₹500 OFF + Free Inspection',
        \`tone\` VARCHAR(50) NOT NULL DEFAULT 'Urgent & Professional',
        \`platform\` VARCHAR(50) NOT NULL DEFAULT 'ALL',
        \`format\` VARCHAR(50) NOT NULL DEFAULT 'Single Image / Reel',
        \`headline\` VARCHAR(255) NOT NULL,
        \`primary_text\` TEXT NOT NULL,
        \`description\` TEXT NULL,
        \`cta\` VARCHAR(50) NOT NULL DEFAULT 'Book Free Inspection',
        \`instagram_caption\` TEXT NULL,
        \`facebook_copy\` TEXT NULL,
        \`whatsapp_copy\` TEXT NULL,
        \`creative_concept\` TEXT NULL,
        \`reel_script\` TEXT NULL,
        \`status\` ENUM('GENERATED', 'SAVED', 'APPROVED', 'PUBLISHED') NOT NULL DEFAULT 'GENERATED',
        \`created_by\` INT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_acg_service\` (\`service\`),
        INDEX \`idx_acg_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20g. Ensure web_pageviews table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`web_pageviews\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`session_id\` VARCHAR(64) NOT NULL,
        \`page_url\` VARCHAR(500) NOT NULL,
        \`path\` VARCHAR(255) NOT NULL,
        \`referrer\` VARCHAR(500) NULL,
        \`source\` VARCHAR(100) NULL,
        \`medium\` VARCHAR(100) NULL,
        \`campaign\` VARCHAR(150) NULL,
        \`content\` VARCHAR(150) NULL,
        \`term\` VARCHAR(150) NULL,
        \`gclid\` VARCHAR(255) NULL,
        \`fbclid\` VARCHAR(255) NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_wp_session\` (\`session_id\`),
        INDEX \`idx_wp_source\` (\`source\`),
        INDEX \`idx_wp_campaign\` (\`campaign\`),
        INDEX \`idx_wp_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 20h. Seed initial Meta campaigns & creatives if table is empty (Demo seed only)
    if (allowDemoSeed) {
      const [existingCmp] = await conn.query(`SELECT id FROM meta_campaigns LIMIT 1`);
      if (existingCmp.length === 0) {
        const [resCmp1] = await conn.query(`
          INSERT INTO meta_campaigns (campaign_id, name, objective, status, daily_budget, location, spend, impressions, clicks, leads, cpl, conversions)
          VALUES ('2384758921031', 'Termite Monsoon Shield 2026', 'OUTCOME_LEADS', 'ACTIVE', 1500.00, 'Pune, Pimpri-Chinchwad', 18420.00, 48200, 1940, 68, 270.88, 19)
        `);
        const [resCmp2] = await conn.query(`
          INSERT INTO meta_campaigns (campaign_id, name, objective, status, daily_budget, location, spend, impressions, clicks, leads, cpl, conversions)
          VALUES ('2384758921032', 'Cockroach Odorless Gel Promo', 'OUTCOME_LEADS', 'ACTIVE', 850.00, 'Pune Central, Baner, Kothrud', 12150.00, 39100, 2180, 74, 164.18, 28)
        `);
        const [resCmp3] = await conn.query(`
          INSERT INTO meta_campaigns (campaign_id, name, objective, status, daily_budget, location, spend, impressions, clicks, leads, cpl, conversions)
          VALUES ('2384758921033', 'Commercial Kitchen HACCP FSSAI', 'OUTCOME_LEADS', 'ACTIVE', 1200.00, 'Pune & Hinjawadi IT Parks', 14900.00, 18200, 890, 22, 677.27, 8)
        `);

        // Seed creatives
        await conn.query(`
          INSERT INTO meta_creatives (creative_id, name, headline, primary_text, description, cta, image_url, ai_generated, status)
          VALUES (
            'cr_901', 'Termite Monsoon Shield Visual', '🛡️ Termite Radar Scan ₹0 + 1-Year Warranty',
            'Detect hidden wood termites before structural damage occurs. Eco-friendly, government approved radar inspection across Pune.',
            'Hassle-free 100% odorless treatment certified by ISO 9001.', 'GET_QUOTE',
            'assets/hero-banner.jpg', TRUE, 'APPROVED'
          ),
          (
            'cr_902', 'Herbal Cockroach Gel Reel', '🪳 Stop Cockroaches In 24 Hours — No Odor, No Emptying Kitchen',
            'Advanced German gel baiting technology safe for children, seniors, and domestic pets. 1-Year service guarantee.',
            '100% money back satisfaction warranty.', 'BOOK_NOW',
            'assets/service-cockroach.jpg', TRUE, 'APPROVED'
          )
        `);

        logger.info('Seeded default Meta campaigns and studio creatives.');
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
