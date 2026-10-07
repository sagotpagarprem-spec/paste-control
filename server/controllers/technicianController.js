// Universal Pest Control — Technician Controller
const technicianModel = require('../models/technicianModel');
const { apiSuccess, apiError } = require('../utils/response');

const technicianController = {
  async getTechnicians(req, res, next) {
    try {
      const techs = await technicianModel.findAll();
      return apiSuccess(res, techs, 'Technicians retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!['Available', 'On Job', 'Off Duty'].includes(status)) {
        return apiError(res, 'Invalid status value. Must be Available, On Job, or Off Duty.', 422);
      }
      const updated = await technicianModel.updateStatus(id, status);
      return apiSuccess(res, updated, 'Technician status updated.');
    } catch (error) {
      next(error);
    }
  },

  async createTechnician(req, res, next) {
    try {
      const tech = await technicianModel.create(req.body);
      return apiSuccess(res, tech, 'Technician created.', 201);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = technicianController;
