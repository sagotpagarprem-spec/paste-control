// Universal Pest Control — Database Configuration & Connection Pool
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'universal_pest_control',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true
};

let pool = null;
let isConnected = false;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// Check database connectivity
async function checkConnection() {
  try {
    const currentPool = getPool();
    const connection = await currentPool.getConnection();
    isConnected = true;
    connection.release();
    logger.info(`MySQL Database connection established: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);
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
  dbConfig
};
