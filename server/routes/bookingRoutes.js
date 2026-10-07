// Universal Pest Control — Booking Routes
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { publicLeadLimiter } = require('../middleware/rateLimiter');
const { validate, validateBookingCreate } = require('../validators/validate');

// Public or Authenticated Booking Creation
// POST /api/bookings
router.post('/', publicLeadLimiter, validate(validateBookingCreate), bookingController.createBooking);

// Protected Admin/Staff Endpoints
// GET /api/bookings
router.get('/', authenticateToken, requirePermission('bookings:read'), bookingController.getBookings);

// GET /api/bookings/:id
router.get('/:id', authenticateToken, requirePermission('bookings:read'), bookingController.getBookingById);

// PUT /api/bookings/:id/status
router.put('/:id/status', authenticateToken, requirePermission('bookings:manage'), bookingController.updateStatus);

module.exports = router;
