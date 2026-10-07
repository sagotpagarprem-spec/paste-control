// Universal Pest Control — Safe Logger Utility
// Sanitizes sensitive fields before logging (passwords, tokens, secrets)

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'db_password',
  'jwt_secret'
]);

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const logger = {
  info: (msg, meta) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.log(`[${timestamp}] [INFO] ${msg}`, JSON.stringify(sanitize(meta)));
    } else {
      console.log(`[${timestamp}] [INFO] ${msg}`);
    }
  },
  warn: (msg, meta) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`[${timestamp}] [WARN] ${msg}`, JSON.stringify(sanitize(meta)));
    } else {
      console.warn(`[${timestamp}] [WARN] ${msg}`);
    }
  },
  error: (msg, error) => {
    const timestamp = new Date().toISOString();
    const errMsg = error ? (error.message || error) : '';
    console.error(`[${timestamp}] [ERROR] ${msg} ${errMsg}`);
  }
};

module.exports = logger;
