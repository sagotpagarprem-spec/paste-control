// Universal Pest Control — JWT Utility
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'upc_default_dev_secret_key_change_in_production_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function generateToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: options.expiresIn || JWT_EXPIRES_IN
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken
};
