// Universal Pest Control — Booking Service
const bookingModel = require('../models/bookingModel');
const notificationModel = require('../models/notificationModel');
const auditLogModel = require('../models/auditLogModel');

class BookingService {
  async getBookings(filters) {
    return await bookingModel.findAll(filters);
  }

  async getBookingById(id) {
    const booking = await bookingModel.findById(id);
    if (!booking) {
      throw new Error('Booking not found.');
    }
    return booking;
  }

  async createBooking(data, ipAddress = null, userAgent = null) {
    const booking = await bookingModel.create(data);

    // Create system notification for new booking
    await notificationModel.create({
      title: 'New Service Booking Confirmed',
      message: `Booking ${booking.booking_code} confirmed for ${booking.customer_name} (${booking.service_name}) on ${booking.scheduled_date}.`,
      type: 'success',
      link: `/admin.html`
    });

    await auditLogModel.log({
      action: 'BOOKING_CREATED',
      entityType: 'booking',
      entityId: String(booking.id),
      ipAddress,
      userAgent,
      details: { bookingCode: booking.booking_code, scheduledDate: booking.scheduled_date }
    });

    return booking;
  }

  async updateBookingStatus(id, status, user = null, ipAddress = null) {
    const updated = await bookingModel.updateStatus(id, status);

    if (user) {
      await auditLogModel.log({
        userId: user.id,
        action: 'BOOKING_STATUS_CHANGED',
        entityType: 'booking',
        entityId: String(id),
        ipAddress,
        details: { status }
      });
    }

    return updated;
  }
}

module.exports = new BookingService();
