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
const { metaRouter, whatsappRouter, campaignsRouter, analyticsRouter } = require('./futureRoutes');

const { apiSuccess } = require('../utils/response');
const { isConnected, dbConfig } = require('../config/database');

// Health Check Endpoint
router.get('/health', (req, res) => {
  return apiSuccess(res, {
    status: 'ONLINE',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: isConnected,
      host: dbConfig.host,
      name: dbConfig.database
    },
    version: '1.0.0-phase2'
  }, 'Universal Pest Control API service is healthy.');
});

// Mount Core API Routes
router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/customers', customerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/services', serviceRoutes);
router.use('/technicians', technicianRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);

// Mount Future Integration Stubs
router.use('/meta', metaRouter);
router.use('/whatsapp', whatsappRouter);
router.use('/campaigns', campaignsRouter);
router.use('/analytics', analyticsRouter);

module.exports = router;
