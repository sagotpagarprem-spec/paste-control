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

  async createBooking(data, ipAddress = null, userAgent = null, user = null) {
    const isStaff = Boolean(user && user.id);

    // Whitelist approved customer, service, and appointment fields
    const customerName = data.name || data.customerName || data.customer_name || 'Customer';
    const phone = data.phone;
    const email = data.email || null;
    const address = data.address || null;
    const city = data.city || 'Pune';
    const propertyType = data.propertyType || data.property_type || data.property || 'Residential';

    const serviceNameInput = data.service || data.serviceName || data.service_name || 'General Pest Control';
    const serviceIdInput = data.serviceId || data.service_id || null;

    const scheduledDateInput = data.date || data.scheduledDate || data.scheduled_date || new Date().toISOString().split('T')[0];
    const timeSlot = data.timeSlot || data.time_slot || data.slot || '10:00 AM - 12:00 PM';
    const instructions = data.instructions || data.notes || null;
    const leadId = data.leadId || data.lead_id || null;

    // Validate appointment availability server-side: date must not be in the past
    const appointmentDate = new Date(scheduledDateInput);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(appointmentDate.getTime()) || appointmentDate < today) {
      throw new Error('Scheduled date must be a valid current or future date.');
    }

    // Server-side service catalog lookup and price validation
    const serviceModel = require('../models/serviceModel');
    let serviceRecord = null;
    if (serviceIdInput) {
      serviceRecord = await serviceModel.findById(serviceIdInput);
    }
    if (!serviceRecord && serviceNameInput) {
      serviceRecord = await serviceModel.findByNameOrId(serviceNameInput);
    }

    const finalServiceId = serviceRecord ? serviceRecord.id : serviceIdInput;
    const finalServiceName = serviceRecord ? serviceRecord.name : serviceNameInput;

    // Determine authoritative price: catalog takes precedence over client-supplied value
    let finalAmount = 0.00;
    if (serviceRecord) {
      finalAmount = Number(serviceRecord.price || serviceRecord.basePrice || 0);
    } else if (isStaff && data.amount !== undefined) {
      finalAmount = Math.max(0, Number(data.amount));
    } else if (data.amount !== undefined) {
      finalAmount = Math.max(0, Number(data.amount));
    }

    // Set initial status on server; reject/ignore administrative statuses
    let initialStatus = 'CONFIRMED';
    if (data.status) {
      const s = String(data.status).toUpperCase();
      if (s === 'PENDING' || s === 'CONFIRMED') {
        initialStatus = s;
      }
    }

    // Do not trust client-supplied technician assignment for public creation
    let technicianId = null;
    if (isStaff && (data.technicianId || data.technician_id)) {
      technicianId = data.technicianId || data.technician_id;
    }

    // 1. Auto-create or update customer profile
    let customerId = data.customerId || data.customer_id;
    if (phone) {
      const customer = await customerModel.upsertFromLeadOrBooking({
        name: customerName,
        phone,
        email,
        address,
        city,
        property_type: propertyType
      });
      if (customer) customerId = customer.id;
    }

    // 2. Prepare strictly whitelisted booking payload
    const bookingPayload = {
      customer_id: customerId,
      customer_name: customerName,
      phone,
      service_id: finalServiceId,
      service_name: finalServiceName,
      technician_id: technicianId,
      property_type: propertyType,
      scheduled_date: scheduledDateInput,
      time_slot: timeSlot,
      address,
      city,
      instructions,
      amount: finalAmount,
      status: initialStatus,
      lead_id: leadId
    };

    const booking = await bookingModel.create(bookingPayload);

    // 3. If connected to a lead, update lead status to BOOKED and record activity
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
        scheduledDate: booking.scheduledDate
      }
    });

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

      // Rescheduled notification
      const dateChanged = (data.scheduledDate && data.scheduledDate !== existing.scheduledDate) ||
                          (data.scheduled_date && data.scheduled_date !== existing.scheduledDate);
      const slotChanged = (data.timeSlot && data.timeSlot !== existing.timeSlot) ||
                          (data.time_slot && data.time_slot !== existing.timeSlot);
      if (dateChanged || slotChanged) {
        await notificationModel.create({
          title: '📅 Booking Rescheduled',
          message: `Booking #${updated.bookingCode} rescheduled to ${updated.scheduledDate} (${updated.timeSlot}).`,
          type: 'info',
          link: '/admin.html'
        });
        if (updated.leadId) {
          await query(
            `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
             VALUES (?, ?, 'BOOKING_RESCHEDULED', ?)`,
            [updated.leadId, user?.id || null, `Booking #${updated.bookingCode} rescheduled to ${updated.scheduledDate} (${updated.timeSlot})`]
          );
        }
      }

      // Cancellation notification
      if (newStatus === 'CANCELLED') {
        await notificationModel.create({
          title: '❌ Booking Cancelled',
          message: `Booking #${updated.bookingCode} for ${updated.customerName} has been cancelled.`,
          type: 'warning',
          link: '/admin.html'
        });
        if (updated.leadId) {
          await query(
            `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
             VALUES (?, ?, 'BOOKING_CANCELLED', ?)`,
            [updated.leadId, user?.id || null, `Booking #${updated.bookingCode} was cancelled.`]
          );
        }
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
