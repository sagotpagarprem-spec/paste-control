// Universal Pest Control — Service Controller
const serviceModel = require('../models/serviceModel');
const { apiSuccess, apiError } = require('../utils/response');

const serviceController = {
  async getServices(req, res, next) {
    try {
      const activeOnly = req.query.all !== 'true';
      const services = await serviceModel.findAll({ activeOnly });
      return apiSuccess(res, services, 'Services retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getServiceById(req, res, next) {
    try {
      const { id } = req.params;
      const service = await serviceModel.findById(id);
      if (!service) {
        return apiError(res, 'Service not found.', 404);
      }
      return apiSuccess(res, service, 'Service retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createService(req, res, next) {
    try {
      const service = await serviceModel.create(req.body);
      return apiSuccess(res, service, 'Service created.', 201);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = serviceController;
