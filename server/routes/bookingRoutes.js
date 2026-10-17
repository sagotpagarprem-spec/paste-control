// Universal Pest Control — Booking Routes
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { publicLeadLimiter, trackingLimiter } = require('../middleware/rateLimiter');
const { validate, validateBookingCreate } = require('../validators/validate');

// Public or Authenticated Booking Creation
// POST /api/bookings
router.post('/', publicLeadLimiter, validate(validateBookingCreate), bookingController.createBooking);

// Public Customer Tracking Endpoint (Protected against abuse and PII leakage)
// GET /api/bookings/:idOrCode/tracking
router.get('/:idOrCode/tracking', trackingLimiter, bookingController.getTracking);

// Public Customer Tracking OTP & Verification Endpoints
// POST /api/bookings/:idOrCode/tracking-otp (Request OTP)
router.post('/:idOrCode/tracking-otp', trackingLimiter, bookingController.requestTrackingOtp);

// POST /api/bookings/:idOrCode/verify-otp (Verify OTP & receive tracking token)
router.post('/:idOrCode/verify-otp', trackingLimiter, bookingController.verifyTrackingOtp);

// Protected Admin/Staff Endpoints
// GET /api/bookings
router.get('/', authenticateToken, requirePermission('bookings:read'), bookingController.getBookings);

// GET /api/bookings/:id
router.get('/:id', authenticateToken, requirePermission('bookings:read'), bookingController.getBookingById);

// POST /api/bookings/:id/assign (Assign Technician)
router.post('/:id/assign', authenticateToken, requirePermission('technicians:manage'), bookingController.assignTechnician);

// PUT /api/bookings/:id
router.put('/:id', authenticateToken, requirePermission('bookings:manage'), bookingController.updateBooking);

// PUT /api/bookings/:id/status
router.put('/:id/status', authenticateToken, requirePermission('bookings:manage'), bookingController.updateStatus);

// DELETE /api/bookings/:id (Archive)
router.delete('/:id', authenticateToken, requirePermission('bookings:manage'), bookingController.deleteBooking);

module.exports = router;
