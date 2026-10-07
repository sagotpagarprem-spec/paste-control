// Universal Pest Control — Customer Controller
const customerModel = require('../models/customerModel');
const { apiSuccess, apiError } = require('../utils/response');

const customerController = {
  async getCustomers(req, res, next) {
    try {
      const { search, city, limit, page, offset } = req.query;
      const result = await customerModel.findAll({
        search,
        city,
        page: page || 1,
        limit: limit || 50,
        offset
      });
      return apiSuccess(res, result.customers || result, 'Customers retrieved successfully.', 200, result.pagination);
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
      return apiSuccess(res, customer, 'Customer profile retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createCustomer(req, res, next) {
    try {
      const { phone } = req.body;
      if (!phone) {
        return apiError(res, 'Customer phone number is required.', 422);
      }
      const customer = await customerModel.create(req.body);
      return apiSuccess(res, customer, 'Customer profile created.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateCustomer(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await customerModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Customer not found.', 404);
      }
      return apiSuccess(res, updated, 'Customer profile updated.');
    } catch (error) {
      next(error);
    }
  },

  async addNote(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      if (!note || typeof note !== 'string' || !note.trim()) {
        return apiError(res, 'Note content cannot be empty.', 422);
      }
      const updated = await customerModel.addNote(id, note.trim(), req.user?.id || null);
      return apiSuccess(res, updated, 'Note added to customer profile.', 201);
    } catch (error) {
      next(error);
    }
  },

  async addReview(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, reviewText, source, bookingId } = req.body;
      const updated = await customerModel.addReview(id, {
        rating: rating || 5.0,
        reviewText: reviewText || '',
        source: source || 'Customer Direct',
        bookingId: bookingId || null
      });
      return apiSuccess(res, updated, 'Customer review recorded.', 201);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = customerController;
