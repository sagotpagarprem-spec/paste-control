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

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow existing frontend styles & svg inline rendering
    crossOriginEmbedderPolicy: false
  })
);

// 2. Cross-Origin Resource Sharing
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  })
);

// 3. Body & Cookie Parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// 4. Rate Limiting for all /api endpoints
app.use('/api', apiLimiter);

// 5. Mount Core API
app.use('/api', apiRoutes);

// 6. Serve Static Frontend Files
const PUBLIC_DIR = path.join(__dirname, '..');

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

// 8. Global Centralized Error Handler
app.use(errorHandler);

module.exports = app;
