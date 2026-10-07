// Universal Pest Control — Service Controller (CRUD)
const serviceModel = require('../models/serviceModel');
const { apiSuccess, apiError } = require('../utils/response');

const serviceController = {
  async getServices(req, res, next) {
    try {
      const activeOnly = req.query.all !== 'true';
      const { category, search, status } = req.query;
      const services = await serviceModel.findAll({ activeOnly, category, search, status });
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
      if (!req.body.name) {
        return apiError(res, 'Service name is required.', 400);
      }
      const service = await serviceModel.create(req.body);
      return apiSuccess(res, service, 'Service created successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateService(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await serviceModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Service not found.', 404);
      }
      return apiSuccess(res, updated, 'Service updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteService(req, res, next) {
    try {
      const { id } = req.params;
      const result = await serviceModel.delete(id);
      if (!result) {
        return apiError(res, 'Service not found.', 404);
      }
      return apiSuccess(res, result, 'Service archived/deleted successfully.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = serviceController;
