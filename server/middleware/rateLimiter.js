// Universal Pest Control — Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

// General API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10), // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Strict Rate Limiter for Authentication Endpoints (Brute Force Protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes before trying again.'
  }
});

// Public Lead / Inbound Submission Limiter (Anti-Spam)
const publicLeadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 submissions per 10 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Submission limit reached. Please wait a few moments before trying again.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  publicLeadLimiter
};
