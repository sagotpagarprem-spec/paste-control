// Universal Pest Control — Master API Router
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const leadRoutes = require('./leadRoutes');
const customerRoutes = require('./customerRoutes');
const bookingRoutes = require('./bookingRoutes');
const serviceRoutes = require('./serviceRoutes');
const technicianRoutes = require('./technicianRoutes');
const notificationRoutes = require('./notificationRoutes');
const userRoutes = require('./userRoutes');
const followupRoutes = require('./followupRoutes');
const cmsRoutes = require('./cmsRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const metaRoutes = require('./metaRoutes');
const campaignRoutes = require('./campaignRoutes');
const creativeRoutes = require('./creativeRoutes');
const analyticsRoutes = require('./analyticsRoutes');

const { apiSuccess } = require('../utils/response');
const db = require('../config/database');

// Health Check Endpoint
router.get('/health', (req, res) => {
  return apiSuccess(res, {
    status: 'ONLINE',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: db.isConnected,
      host: db.dbConfig.host,
      name: db.dbConfig.database
    },
    version: '1.0.0-production'
  }, 'Universal Pest Control API service is healthy.');
});

// Mount Core API Routes
router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/customers', customerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/followups', followupRoutes);
router.use('/services', serviceRoutes);
router.use('/cms', cmsRoutes);
router.use('/technicians', technicianRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);

// Mount WhatsApp Business Cloud API & Webhooks
router.use('/whatsapp', whatsappRoutes);

// Mount Meta (Facebook & Instagram) Lead Ads & Webhooks
router.use('/meta', metaRoutes);

// Mount Campaigns (Phase 8), AI Creatives (Phase 9), Analytics (Phase 10)
router.use('/campaigns', campaignRoutes);
router.use('/creatives', creativeRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
