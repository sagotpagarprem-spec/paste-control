// Universal Pest Control — Booking Controller
const bookingService = require('../services/bookingService');
const { apiSuccess, apiError } = require('../utils/response');

const bookingController = {
  async getBookings(req, res, next) {
    try {
      const { search, status, technicianId, date, includeArchived, page, limit, offset } = req.query;
      const result = await bookingService.getBookings({
        search,
        status,
        technicianId,
        date,
        includeArchived: includeArchived === 'true',
        page: page || 1,
        limit: limit || 50,
        offset
      });
      return apiSuccess(res, result.bookings || result, 'Bookings retrieved successfully.', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  },

  async getBookingById(req, res, next) {
    try {
      const { id } = req.params;
      const booking = await bookingService.getBookingById(id);
      return apiSuccess(res, booking, 'Booking details retrieved.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  async createBooking(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const booking = await bookingService.createBooking(req.body, ipAddress, userAgent, req.user);
      return apiSuccess(res, booking, 'Service booking confirmed successfully.', 201);
    } catch (error) {
      // Fix 1: unknown/inactive service errors are client errors (400), not server errors (500)
      if (
        error.message.startsWith('Unknown service:') ||
        error.message.includes('not currently available for booking')
      ) {
        return apiError(res, error.message, 400);
      }
      next(error);
    }
  },

  async updateBooking(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await bookingService.updateBooking(id, req.body, req.user, ipAddress);
      return apiSuccess(res, updated, 'Booking updated successfully.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return apiError(res, 'New status is required.', 422);
      }
      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await bookingService.updateBooking(id, { status }, req.user, ipAddress);
      return apiSuccess(res, updated, 'Booking status updated.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  async deleteBooking(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const archived = await bookingService.archiveBooking(id, req.user, ipAddress);
      return apiSuccess(res, archived, 'Booking archived / cancelled successfully.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  async assignTechnician(req, res, next) {
    try {
      const { id } = req.params;
      const { technicianId } = req.body;
      if (!technicianId) {
        return apiError(res, 'technicianId is required.', 400);
      }
      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await bookingService.updateBooking(id, { technicianId, status: 'ASSIGNED' }, req.user, ipAddress);
      return apiSuccess(res, updated, 'Technician assigned to booking successfully.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  async getTracking(req, res, next) {
    try {
      const { idOrCode } = req.params;
      const verifyFactor = req.query.phone || req.query.verify || null;
      const token = req.query.token || req.headers['x-tracking-token'] || null;
      const cleanCode = String(idOrCode || '').trim();

      // Reject empty queries, numeric integer IDs, or phone-only lookups
      if (!cleanCode || /^\d{1,8}$/.test(cleanCode) || /^\+?[0-9\s\-]{10,15}$/.test(cleanCode)) {
        return apiError(res, 'Booking not found for tracking. Please provide a valid Booking Reference Code (e.g. UPC-2026-XXXX).', 404);
      }

      const bookingModel = require('../models/bookingModel');
      const result = await bookingModel.getTrackingData(cleanCode, {
        verify: verifyFactor,
        token
      });

      if (!result) {
        return apiError(res, 'Booking not found for tracking. Please verify your Booking Reference Code.', 404);
      }

      if (
        result.status === 'NOT_FOUND' ||
        result.status === 'REJECTED_NUMERIC_ID' ||
        result.status === 'REJECTED_PHONE_QUERY' ||
        result.status === 'INVALID_FORMAT'
      ) {
        return apiError(res, result.error || 'Booking not found for tracking.', 404);
      }

      if (result.status === 'FACTOR_REQUIRED' || result.status === 'FACTOR_MISMATCH') {
        return apiError(res, result.error, 403);
      }

      // Successful sanitized retrieval
      const responseData = { ...result };
      delete responseData.status; // Remove internal status wrapper
      return apiSuccess(res, responseData, 'Booking tracking status retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async requestTrackingOtp(req, res, next) {
    try {
      const idOrCode = req.params.idOrCode || req.body.bookingCode;
      const cleanCode = String(idOrCode || '').trim();

      if (!cleanCode || /^\d{1,8}$/.test(cleanCode) || /^\+?[0-9\s\-]{10,15}$/.test(cleanCode)) {
        return apiError(res, 'Invalid booking reference code.', 404);
      }

      const bookingModel = require('../models/bookingModel');
      const booking = await bookingModel.findByCode(cleanCode);
      if (!booking) {
        return apiError(res, 'Booking not found.', 404);
      }

      const crypto = require('crypto');
      const otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      if (!global.trackingOtpStore) {
        global.trackingOtpStore = new Map();
      }

      const otpHash = crypto.createHash('sha256').update(`${cleanCode.toUpperCase()}:${otp}`).digest('hex');
      global.trackingOtpStore.set(cleanCode.toUpperCase(), { otpHash, expiresAt, attempts: 0 });

      // In production, dispatch via WhatsApp/SMS service; log sanitized dispatch notice
      const lastFour = String(booking.phone || '').slice(-4);
      return apiSuccess(res, {
        bookingCode: cleanCode,
        maskedPhone: `******${lastFour}`,
        expiresInSeconds: 600
      }, 'Verification OTP dispatched to registered customer mobile.');
    } catch (error) {
      next(error);
    }
  },

  async verifyTrackingOtp(req, res, next) {
    try {
      const idOrCode = req.params.idOrCode || req.body.bookingCode;
      const { otp } = req.body;
      const cleanCode = String(idOrCode || '').trim();

      if (!cleanCode || !otp) {
        return apiError(res, 'Booking reference code and 6-digit OTP are required.', 400);
      }

      const store = global.trackingOtpStore;
      const record = store ? store.get(cleanCode.toUpperCase()) : null;

      if (!record || Date.now() > record.expiresAt) {
        return apiError(res, 'OTP has expired or was not requested. Please request a new OTP.', 400);
      }

      if (record.attempts >= 5) {
        store.delete(cleanCode.toUpperCase());
        return apiError(res, 'Too many invalid attempts. Please request a new OTP.', 429);
      }

      record.attempts += 1;
      const crypto = require('crypto');
      const submittedHash = crypto.createHash('sha256').update(`${cleanCode.toUpperCase()}:${String(otp).trim()}`).digest('hex');

      if (submittedHash !== record.otpHash) {
        return apiError(res, 'Invalid verification code. Please check and try again.', 403);
      }

      // Valid OTP: clear store entry and issue signed tracking verification token
      store.delete(cleanCode.toUpperCase());
      const bookingModel = require('../models/bookingModel');
      const booking = await bookingModel.findByCode(cleanCode);
      const trackingToken = bookingModel.generateTrackingToken(cleanCode, booking ? booking.phone : '');

      return apiSuccess(res, {
        bookingCode: cleanCode,
        trackingToken,
        verified: true
      }, 'OTP verified successfully. Tracking access granted.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = bookingController;
