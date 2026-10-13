// Universal Pest Control — Express Application Setup
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// 1. Production Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline SVG and custom styling while keeping other shields active
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'sameorigin' },
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
);

// 1b. Root Health Check for Cloud Load Balancers & Orchestrators
const db = require('./config/database');
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ONLINE',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: db.isConnected,
      host: db.dbConfig.host,
      name: db.dbConfig.database
    },
    version: '1.0.0-production'
  });
});

// 2. Cross-Origin Resource Sharing
const isProduction = process.env.NODE_ENV === 'production';
const rawCorsOrigin = process.env.CORS_ORIGIN;
const allowedOrigins = rawCorsOrigin && rawCorsOrigin !== '*'
  ? rawCorsOrigin.split(',').map((o) => o.trim())
  : null;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., server-to-server, mobile native, curl, local test runners)
      if (!origin) return callback(null, true);

      if (allowedOrigins) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin blocked by CORS policy.'));
      }

      // In production, prohibit wildcard origin when credentials are enabled
      if (isProduction) {
        return callback(new Error('CORS_ORIGIN must be explicitly configured in production when credentials are enabled.'));
      }

      // In development / test, reflect origin to support local dev tooling
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  })
);

// 3. Body & Cookie Parsing (Preserve rawBody for webhook HMAC signatures)
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// 4. Rate Limiting for all /api endpoints
app.use('/api', apiLimiter);

// 5. Mount Core API
app.use('/api', apiRoutes);

// 6. Serve Static Frontend Files & SEO endpoints
const PUBLIC_DIR = path.join(__dirname, '..');

// SEO Robots & Sitemap
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(PUBLIC_DIR, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(PUBLIC_DIR, 'sitemap.xml'));
});

// Admin route alias
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

// Login route alias
app.get('/login', (req, res) => {
  res.redirect('/login.html');
});

app.use(
  express.static(PUBLIC_DIR, {
    index: 'index.html',
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
  })
);

// 7. API 404 Handler (only intercepts unmatched /api routes)
app.use('/api', notFoundHandler);

// 8. Global Web 404 Handler for non-API web navigation
app.use((req, res, next) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  } else {
    next();
  }
});

// 9. Global Centralized Error Handler
app.use(errorHandler);

module.exports = app;
