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
      const cleanCode = String(idOrCode || '').trim();

      // Reject empty queries, numeric integer IDs, or phone-only lookups
      if (!cleanCode || /^\d{1,8}$/.test(cleanCode) || /^\+?[0-9\s\-]{10,15}$/.test(cleanCode)) {
        return apiError(res, 'Booking not found for tracking. Please provide a valid Booking Reference Code (e.g. UPC-2026-XXXX).', 404);
      }

      const bookingModel = require('../models/bookingModel');
      const trackingData = await bookingModel.getTrackingData(cleanCode, verifyFactor);
      if (!trackingData) {
        return apiError(res, 'Booking not found for tracking. Please verify your Booking Reference Code.', 404);
      }
      return apiSuccess(res, trackingData, 'Booking tracking status retrieved.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = bookingController;
