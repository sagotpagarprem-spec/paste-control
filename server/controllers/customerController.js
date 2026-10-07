// Universal Pest Control — Customer Controller
const customerModel = require('../models/customerModel');
const { apiSuccess, apiError } = require('../utils/response');

const customerController = {
  async getCustomers(req, res, next) {
    try {
      const { search, limit, offset } = req.query;
      const customers = await customerModel.findAll({ search, limit, offset });
      return apiSuccess(res, customers, 'Customers retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getCustomerById(req, res, next) {
    try {
      const { id } = req.params;
      const customer = await customerModel.findById(id);
      if (!customer) {
        return apiError(res, 'Customer not found.', 404);
      }
      return apiSuccess(res, customer, 'Customer details retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createCustomer(req, res, next) {
    try {
      const customer = await customerModel.create(req.body);
      return apiSuccess(res, customer, 'Customer record created.', 201);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = customerController;
