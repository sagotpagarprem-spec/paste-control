// Universal Pest Control — Technician Controller (Phase 5)
const technicianModel = require('../models/technicianModel');
const bookingModel = require('../models/bookingModel');
const notificationModel = require('../models/notificationModel');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');
const { apiSuccess, apiError } = require('../utils/response');

const technicianController = {
  async getTechnicians(req, res, next) {
    try {
      const { search, status, availability, skill, area } = req.query;
      const techs = await technicianModel.findAll({ search, status, availability, skill, area });
      return apiSuccess(res, techs, 'Technicians retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getTechnicianById(req, res, next) {
    try {
      const { id } = req.params;
      const tech = await technicianModel.findById(id);
      if (!tech) {
        return apiError(res, 'Technician not found.', 404);
      }
      return apiSuccess(res, tech, 'Technician details retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createTechnician(req, res, next) {
    try {
      const { name, phone } = req.body;
      if (!name || !phone) {
        return apiError(res, 'Technician name and phone are required.', 400);
      }
      const tech = await technicianModel.create(req.body);
      return apiSuccess(res, tech, 'Technician profile created.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateTechnician(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await technicianModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Technician not found.', 404);
      }
      return apiSuccess(res, updated, 'Technician updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return apiError(res, 'Status is required.', 400);
      }
      const valid = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
      const normalized = String(status).toUpperCase();
      if (!valid.includes(normalized)) {
        return apiError(res, `Invalid status. Must be one of: ${valid.join(', ')}`, 422);
      }
      const updated = await technicianModel.updateStatus(id, normalized);
      return apiSuccess(res, updated, `Technician status updated to ${normalized}.`);
    } catch (error) {
      next(error);
    }
  },

  async updateAvailability(req, res, next) {
    try {
      const { id } = req.params;
      const { availability } = req.body;
      if (!availability) {
        return apiError(res, 'Availability value is required.', 400);
      }
      const valid = ['AVAILABLE', 'ON_JOB', 'BUSY', 'OFF_DUTY'];
      const normalized = String(availability).toUpperCase();
      if (!valid.includes(normalized)) {
        return apiError(res, `Invalid availability. Must be one of: ${valid.join(', ')}`, 422);
      }
      const updated = await technicianModel.updateAvailability(id, normalized);
      return apiSuccess(res, updated, `Technician availability set to ${normalized}.`);
    } catch (error) {
      next(error);
    }
  },

  async deleteTechnician(req, res, next) {
    try {
      const { id } = req.params;
      const result = await technicianModel.delete(id);
      if (!result) {
        return apiError(res, 'Technician not found.', 404);
      }
      return apiSuccess(res, result, 'Technician deactivated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getTechnicianJobs(req, res, next) {
    try {
      const { id } = req.params;
      const jobsData = await technicianModel.getJobs(id);
      if (!jobsData) {
        return apiError(res, 'Technician not found.', 404);
      }
      return apiSuccess(res, jobsData, 'Technician job schedule retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async updateJobStatus(req, res, next) {
    try {
      const { id, bookingId } = req.params;
      const { status, notes } = req.body;
      if (!status) {
        return apiError(res, 'Status is required.', 400);
      }

      const validStatuses = ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      const normalized = String(status).toUpperCase();
      if (!validStatuses.includes(normalized)) {
        return apiError(res, `Invalid job status: ${status}. Must be one of: ${validStatuses.join(', ')}`, 422);
      }

      const booking = await bookingModel.findById(bookingId);
      if (!booking) {
        return apiError(res, 'Booking not found.', 404);
      }

      const updated = await bookingModel.updateJobStatus(bookingId, normalized, notes);

      // Create notification for dispatch / managers
      const statusLabels = {
        ACCEPTED: 'Job Accepted by Technician',
        ON_THE_WAY: 'Technician On The Way',
        ARRIVED: 'Technician Arrived at Location',
        IN_PROGRESS: 'Service Started',
        COMPLETED: 'Service Completed & Certified',
        CANCELLED: 'Job Cancelled'
      };

      await notificationModel.create({
        title: `👷 ${statusLabels[normalized] || normalized}`,
        message: `Booking #${booking.bookingCode} for ${booking.customerName} is now ${normalized}.`,
        type: normalized === 'COMPLETED' ? 'BOOKING_COMPLETED' : 'BOOKING_ASSIGNED',
        link: '/admin.html'
      });

      // Phase 6 WhatsApp Automations: Technician update & completion
      if (normalized === 'COMPLETED') {
        whatsappService.sendServiceCompleted(booking).catch(err => {
          logger.warn(`[WhatsApp Auto] Job complete template failed: ${err.message}`);
        });
        whatsappService.sendReviewRequest(booking).catch(err => {
          logger.warn(`[WhatsApp Auto] Job review template failed: ${err.message}`);
        });
      } else if (normalized === 'ON_THE_WAY' || normalized === 'ACCEPTED') {
        whatsappService.sendTechnicianAssigned(booking).catch(err => {
          logger.warn(`[WhatsApp Auto] Technician update template failed: ${err.message}`);
        });
      }

      return apiSuccess(res, updated, `Job status updated to ${normalized}.`);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = technicianController;
