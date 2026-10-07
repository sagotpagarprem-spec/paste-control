// Universal Pest Control — Centralized Error Handling Middleware
const logger = require('../utils/logger');
const { apiError } = require('../utils/response');

// 404 Route Not Found Handler (for /api routes)
function notFoundHandler(req, res, next) {
  return apiError(res, `API route not found: ${req.method} ${req.originalUrl}`, 404);
}

// Global Express Error Handler
function errorHandler(err, req, res, next) {
  // If response already sent, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  // Log error safely
  logger.error(`Unhandled Exception on ${req.method} ${req.originalUrl}:`, err);

  // 1. JSON Body Parsing Error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return apiError(res, 'Malformed JSON payload.', 400);
  }

  // 2. MySQL Errors
  if (err.code === 'ER_DUP_ENTRY') {
    return apiError(res, 'Duplicate entry: A record with this unique identifier or email already exists.', 409);
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return apiError(res, 'Foreign key constraint failed: Referenced record does not exist.', 400);
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return apiError(res, 'Database connection is temporarily unavailable. Please verify MySQL configuration.', 503);
  }

  // 3. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return apiError(res, 'Invalid security token.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return apiError(res, 'Security token expired. Please log in again.', 401);
  }

  // 4. Default 500 Internal Server Error
  const isDev = process.env.NODE_ENV !== 'production';
  const responseMessage = isDev ? err.message : 'Internal Server Error';

  return apiError(res, responseMessage, err.status || 500, isDev ? { stack: err.stack } : null);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
