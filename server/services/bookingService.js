// Universal Pest Control — Booking Service
const bookingModel = require('../models/bookingModel');
const customerModel = require('../models/customerModel');
const notificationModel = require('../models/notificationModel');
const auditLogModel = require('../models/auditLogModel');
const { query } = require('../config/database');
const whatsappService = require('./whatsappService');
const logger = require('../utils/logger');

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
    // 1. Auto-create or update customer profile
    let customerId = data.customerId || data.customer_id;
    const phone = data.phone;
    if (phone) {
      const customer = await customerModel.upsertFromLeadOrBooking({
        name: data.customerName || data.customer_name || data.name,
        phone,
        email: data.email,
        address: data.address,
        city: data.city,
        property_type: data.propertyType || data.property_type
      });
      if (customer) customerId = customer.id;
    }

    // 2. Prepare booking payload
    const bookingPayload = {
      ...data,
      customer_id: customerId,
      status: (data.status ? String(data.status).toUpperCase() : 'CONFIRMED')
    };

    const booking = await bookingModel.create(bookingPayload);

    // 3. If connected to a lead, update lead status to BOOKED and record activity
    const leadId = data.leadId || data.lead_id;
    if (leadId) {
      await query(`UPDATE leads SET status = 'BOOKED', customer_id = ? WHERE id = ?`, [customerId, leadId]);
      await query(
        `INSERT INTO lead_activities (lead_id, activity_type, description)
         VALUES (?, 'BOOKING_CREATED', ?)`,
        [leadId, `Confirmed booking created (#${booking.bookingCode}) for ${booking.scheduledDate} ${booking.timeSlot}`]
      );
    }

    // 4. Create Notification: BOOKING_CREATED / BOOKING_CONFIRMED
    const notifType = booking.status === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : 'BOOKING_CREATED';
    await notificationModel.create({
      title: '📋 Booking Confirmed',
      message: `Booking #${booking.bookingCode} for ${booking.customerName} (${booking.serviceName}) on ${booking.scheduledDate}.`,
      type: notifType,
      link: '/admin.html'
    });

    // 5. Audit Log
    await auditLogModel.log({
      action: 'BOOKING_CREATED',
      entityType: 'booking',
      entityId: String(booking.id),
      ipAddress,
      userAgent,
      details: {
        bookingCode: booking.bookingCode,
        customerName: booking.customerName,
        service: booking.serviceName,
        scheduledDate: booking.scheduledDate,
    // 6. Phase 6 WhatsApp Business Automation: Send approved booking confirmation template
    const bookingRecipientPhone = booking.phone || booking.customerPhone || phone;
    if (bookingRecipientPhone) {
      whatsappService.sendBookingConfirmation({ ...booking, phone: bookingRecipientPhone }).catch(err => {
        logger.warn(`[WhatsApp Auto] Booking confirmation template failed for #${booking.bookingCode}: ${err.message}`);
      });
    }

    return booking;
  }

  async updateBooking(id, data, user = null, ipAddress = null) {
    const existing = await bookingModel.findById(id);
    if (!existing) {
      throw new Error('Booking not found.');
    }

    const updated = await bookingModel.update(id, data);

    // Notifications and activities on status / technician changes
    const newStatus = data.status ? String(data.status).toUpperCase() : existing.status;
    const newTechId = data.technicianId !== undefined ? data.technicianId : (data.technician_id !== undefined ? data.technician_id : existing.technicianId);

    // Technician assignment notification
    if (newTechId && newTechId !== existing.technicianId) {
      await notificationModel.create({
        title: '👷 Technician Dispatched',
        message: `Booking #${updated.bookingCode} assigned to ${updated.technicianName || 'Technician'}.`,
        type: 'BOOKING_ASSIGNED',
        link: '/admin.html'
      });
      if (updated.leadId) {
        await query(
          `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
           VALUES (?, ?, 'TECHNICIAN_ASSIGNED', ?)`,
          [updated.leadId, user?.id || null, `Technician ${updated.technicianName || ''} assigned to booking #${updated.bookingCode}`]
        );
      }

      // Phase 6 WhatsApp Automation: Technician Assignment Alert
      whatsappService.sendTechnicianAssigned(updated).catch(err => {
        logger.warn(`[WhatsApp Auto] Technician assignment message failed: ${err.message}`);
      });
    }

    // Status change notification
    if (newStatus && newStatus !== existing.status) {
      let notifType = 'info';
      if (newStatus === 'CONFIRMED') notifType = 'BOOKING_CONFIRMED';
      else if (newStatus === 'COMPLETED') notifType = 'BOOKING_COMPLETED';
      else if (newStatus === 'ASSIGNED') notifType = 'BOOKING_ASSIGNED';

      await notificationModel.create({
        title: `Booking Status: ${newStatus}`,
        message: `Booking #${updated.bookingCode} status updated from ${existing.status} to ${newStatus}.`,
        type: notifType,
        link: '/admin.html'
      });

      if (updated.leadId) {
        await query(
          `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
           VALUES (?, ?, 'STATUS_CHANGE', ?)`,
          [updated.leadId, user?.id || null, `Booking #${updated.bookingCode} status updated to ${newStatus}`]
        );
        if (newStatus === 'COMPLETED') {
          await query(`UPDATE leads SET status = 'COMPLETED' WHERE id = ?`, [updated.leadId]);
        }
      }

      // Phase 6 WhatsApp Automations: Service Completed & Review Request
      if (newStatus === 'COMPLETED') {
        whatsappService.sendServiceCompleted(updated).catch(err => {
          logger.warn(`[WhatsApp Auto] Service completion message failed: ${err.message}`);
        });
        whatsappService.sendReviewRequest(updated).catch(err => {
          logger.warn(`[WhatsApp Auto] Review request message failed: ${err.message}`);
        });
      }
    }

    if (user) {
      await auditLogModel.log({
        userId: user.id,
        action: 'BOOKING_UPDATED',
        entityType: 'booking',
        entityId: String(id),
        ipAddress,
        details: data
      });
    }

    return updated;
  }

  async archiveBooking(id, user = null, ipAddress = null) {
    const existing = await bookingModel.findById(id);
    if (!existing) {
      throw new Error('Booking not found.');
    }

    const archived = await bookingModel.archive(id);

    if (user) {
      await auditLogModel.log({
        userId: user.id,
        action: 'BOOKING_ARCHIVED',
        entityType: 'booking',
        entityId: String(id),
        ipAddress,
        details: { bookingCode: existing.bookingCode, status: 'CANCELLED' }
      });
    }

    return archived;
  }
}

module.exports = new BookingService();
