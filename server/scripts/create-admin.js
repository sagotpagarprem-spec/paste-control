// Universal Pest Control — Safe First-Admin Account Setup Script
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const { query, checkConnection } = require('../config/database');
const logger = require('../utils/logger');

// Parse CLI flags: --email=... --password=... --name=... --phone=...
function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.substring(2).split('=');
      args[key] = valueParts.join('=');
    }
  }
  return args;
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createOrUpdateAdmin() {
  console.log('=====================================================================');
  console.log('UNIVERSAL PEST CONTROL — FIRST ADMIN ACCOUNT SETUP');
  console.log('=====================================================================');

  const args = parseArgs();

  // Retrieve inputs from CLI arguments, environment variables, or interactive prompt
  let email = args.email || process.env.ADMIN_SETUP_EMAIL;
  let password = args.password || process.env.ADMIN_SETUP_PASSWORD;
  let name = args.name || process.env.ADMIN_SETUP_NAME || 'System Administrator';
  let phone = args.phone || process.env.ADMIN_SETUP_PHONE || '9823044129';

  if (!email && process.stdin.isTTY) {
    email = await prompt('Enter Admin Email Address: ');
  }
  if (!password && process.stdin.isTTY) {
    password = await prompt('Enter Admin Password (min 8 characters): ');
  }

  if (!email || !email.includes('@')) {
    console.error('Error: A valid email address is required. Provide via --email=... or ADMIN_SETUP_EMAIL.');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('Error: A secure password of at least 8 characters is required. Provide via --password=... or ADMIN_SETUP_PASSWORD.');
    process.exit(1);
  }

  email = email.trim().toLowerCase();

  console.log(`Connecting to MySQL database...`);
  const isDbConnected = await checkConnection();
  if (!isDbConnected) {
    console.error('Error: Could not connect to MySQL database. Please verify your DB_* credentials in .env.');
    process.exit(1);
  }

  // 1. Ensure 'admin' role exists
  const roleRows = await query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
  let adminRoleId;
  if (roleRows.length > 0) {
    adminRoleId = roleRows[0].id;
  } else {
    const roleInsert = await query(
      `INSERT INTO roles (name, display_name, description) VALUES ('admin', 'Administrator', 'Full system and platform access')`
    );
    adminRoleId = roleInsert.insertId;
    console.log(`Created default 'admin' role (ID: ${adminRoleId}).`);
  }

  // 2. Hash password with bcrypt (10 salt rounds)
  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Check if user already exists
  const existingUsers = await query(`SELECT id, uuid, email, name FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`, [email]);

  if (existingUsers.length > 0) {
    const existing = existingUsers[0];
    console.log(`User '${email}' already exists (ID: ${existing.id}). Safely updating password and admin privileges...`);

    await query(
      `UPDATE users
       SET password_hash = ?, name = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [passwordHash, name || existing.name, existing.id]
    );

    // Ensure user has admin role in user_roles
    await query(
      `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      [existing.id, adminRoleId]
    );

    console.log(`SUCCESS: Admin account updated successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Role: admin`);
    console.log(`User ID: ${existing.id}`);
  } else {
    const userUuid = crypto.randomUUID();
    console.log(`Creating new admin account for '${email}'...`);

    const insertResult = await query(
      `INSERT INTO users (uuid, name, email, password_hash, phone, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [userUuid, name, email, passwordHash, phone]
    );

    const newUserId = insertResult.insertId;

    // Assign admin role
    await query(
      `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      [newUserId, adminRoleId]
    );

    console.log(`SUCCESS: New Admin account created successfully!`);
    console.log(`Email: ${email}`);
    console.log(`UUID: ${userUuid}`);
    console.log(`User ID: ${newUserId}`);
    console.log(`Role: admin`);
  }

  console.log('=====================================================================');
  console.log('Admin account is ready for production login.');
  console.log('=====================================================================');
  process.exit(0);
}

createOrUpdateAdmin().catch((err) => {
  console.error('Fatal error setting up admin account:', err);
  process.exit(1);
});
