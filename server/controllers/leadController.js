// Universal Pest Control — Lead Controller
const leadService = require('../services/leadService');
const { apiSuccess, apiError } = require('../utils/response');

const leadController = {
  async getLeads(req, res, next) {
    try {
      const { search, status, service, source, assignedTo, page, limit } = req.query;
      const result = await leadService.getLeads({
        search,
        status,
        service,
        source,
        assignedTo,
        page: page || 1,
        limit: limit || 100
      });
      return apiSuccess(res, result.leads || result, 'Leads retrieved successfully.', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  },

  async getLeadById(req, res, next) {
    try {
      const { id } = req.params;
      const lead = await leadService.getLeadById(id);
      return apiSuccess(res, lead, 'Lead details retrieved.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  async createLead(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const lead = await leadService.createLead(req.body, ipAddress, userAgent);
      return apiSuccess(res, lead, 'Lead created successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateLead(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await leadService.updateLead(id, req.body, req.user, ipAddress);
      return apiSuccess(res, updated, 'Lead updated successfully.');
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

      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await leadService.addNote(id, note.trim(), req.user, ipAddress);
      return apiSuccess(res, updated, 'Note added successfully.', 201);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = leadController;
