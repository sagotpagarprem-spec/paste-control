// Universal Pest Control — Hardened JWT Utility
const jwt = require('jsonwebtoken');
const logger = require('./logger');

const KNOWN_INSECURE_SECRETS = [
  'upc_default_dev_secret_key_change_in_production_2026',
  'universal_pest_control_super_secret_jwt_key_2026_enterprise_phase6',
  'universal_pest_control_jwt_secret_key_2026',
  'upc_production_jwt_secret_key_change_in_env_2026_super_secure',
  'your_super_secret_jwt_key_at_least_32_characters_long',
  'upc_dev_session_secret_key_non_production_only_2026',
  'secret',
  'changeme',
  'jwt_secret',
  'test_secret'
];

/**
 * Validates JWT_SECRET in production.
 * Throws a fatal error if missing, weak (<32 chars), or matching known defaults.
 */
function validateJwtSecret(env = process.env.NODE_ENV, secret = process.env.JWT_SECRET) {
  const isProd = env === 'production';
  if (isProd) {
    if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required in production and cannot be empty.');
    }
    if (secret.length < 32) {
      throw new Error(`FATAL SECURITY ERROR: JWT_SECRET in production must be at least 32 characters long (received: ${secret.length}).`);
    }
    const lower = secret.toLowerCase();
    if (
      KNOWN_INSECURE_SECRETS.includes(lower) ||
      lower.includes('change_in_production') ||
      lower.includes('your_super_secret')
    ) {
      throw new Error('FATAL SECURITY ERROR: A known default or insecure fallback JWT_SECRET cannot be used in production.');
    }
    return secret;
  }

  // Non-production fallback with warning
  if (!secret) {
    logger.warn('[SECURITY WARNING] Running with development fallback JWT secret. Never use in production!');
    return 'upc_dev_session_secret_key_non_production_only_2026';
  }
  return secret;
}

function getSecret() {
  return validateJwtSecret(process.env.NODE_ENV, process.env.JWT_SECRET);
}

function generateToken(payload, options = {}) {
  const secret = getSecret();
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token) {
  const secret = getSecret();
  return jwt.verify(token, secret);
}

module.exports = {
  validateJwtSecret,
  generateToken,
  verifyToken
};
