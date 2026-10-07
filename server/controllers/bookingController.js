// Universal Pest Control — Booking Controller
const bookingService = require('../services/bookingService');
const { apiSuccess, apiError } = require('../utils/response');

const bookingController = {
  async getBookings(req, res, next) {
    try {
      const { status, limit, offset } = req.query;
      const bookings = await bookingService.getBookings({ status, limit, offset });
      return apiSuccess(res, bookings, 'Bookings retrieved successfully.');
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
      const booking = await bookingService.createBooking(req.body, ipAddress, userAgent);
      return apiSuccess(res, booking, 'Service booking confirmed successfully.', 201);
    } catch (error) {
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
      const updated = await bookingService.updateBookingStatus(id, status, req.user, ipAddress);
      return apiSuccess(res, updated, 'Booking status updated.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = bookingController;
