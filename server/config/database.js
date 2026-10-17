// Universal Pest Control — Database Configuration & Connection Pool
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * Hardens production database configuration validation.
 * Fails safely at startup when production configuration is missing or insecure.
 */
function validateDatabaseConfig(env = process.env.NODE_ENV, overrides = {}) {
  const isProd = env === 'production';
  const host = overrides.host !== undefined ? overrides.host : process.env.DB_HOST;
  const user = overrides.user !== undefined ? overrides.user : process.env.DB_USER;
  const password = overrides.password !== undefined ? overrides.password : process.env.DB_PASSWORD;
  const database = overrides.database !== undefined ? overrides.database : process.env.DB_NAME;

  if (isProd) {
    const missing = [];
    if (!host || typeof host !== 'string' || !host.trim()) missing.push('DB_HOST');
    if (!user || typeof user !== 'string' || !user.trim()) missing.push('DB_USER');
    if (password === undefined || password === null || (typeof password === 'string' && password.trim() === '')) missing.push('DB_PASSWORD');
    if (!database || typeof database !== 'string' || !database.trim()) missing.push('DB_NAME');

    if (missing.length > 0) {
      throw new Error(`FATAL DATABASE CONFIG ERROR: Missing required production database environment variables: ${missing.join(', ')}.`);
    }

    if (String(user).trim().toLowerCase() === 'root') {
      throw new Error('FATAL SECURITY ERROR: Running as MySQL "root" user is disallowed in production. Configure a dedicated application database user.');
    }

    if (password === '') {
      throw new Error('FATAL SECURITY ERROR: Empty database password is strictly disallowed in production.');
    }

    return {
      host: host.trim(),
      port: parseInt(overrides.port || process.env.DB_PORT || '3306', 10),
      user: user.trim(),
      password,
      database: database.trim()
    };
  }

  // Non-production fallback with warning if using development defaults
  if (!process.env.DB_PASSWORD && !overrides.password) {
    logger.warn('[SECURITY WARNING] Running with development fallback database credentials. Never use in production!');
  }

  return {
    host: host || 'localhost',
    port: parseInt(overrides.port || process.env.DB_PORT || '3306', 10),
    user: user || 'root',
    password: password !== undefined ? password : '',
    database: database || 'universal_pest_control'
  };
}

function getDbConfig() {
  const validated = validateDatabaseConfig(process.env.NODE_ENV);
  return {
    host: validated.host,
    port: validated.port,
    user: validated.user,
    password: validated.password,
    database: validated.database,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true
  };
}

let pool = null;
let isConnected = false;

function getPool() {
  if (!pool) {
    const config = getDbConfig();
    pool = mysql.createPool(config);
  }
  return pool;
}

// Check database connectivity
async function checkConnection() {
  try {
    const config = getDbConfig();
    const currentPool = getPool();
    const connection = await currentPool.getConnection();
    isConnected = true;
    connection.release();
    // Never print secrets/passwords in logs
    logger.info(`MySQL Database connection established: ${config.database}@${config.host}:${config.port}`);
    return true;
  } catch (error) {
    isConnected = false;
    logger.warn(`MySQL connection pending or unavailable (${error.code || error.message}). Database operations will return 503 until connected.`);
    return false;
  }
}

// Parameterized query runner
async function query(sql, params = []) {
  const currentPool = getPool();
  try {
    const [rows, fields] = await currentPool.query(sql, params);
    return rows;
  } catch (error) {
    logger.error(`Database query error: ${error.message}`);
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const currentPool = getPool();
  const connection = await currentPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error(`Database transaction rolled back: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getPool,
  checkConnection,
  query,
  transaction,
  get isConnected() {
    return isConnected;
  },
  validateDatabaseConfig,
  getDbConfig,
  get dbConfig() {
    return getDbConfig();
  }
};
