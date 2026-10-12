// Universal Pest Control — Lead Controller
const leadService = require('../services/leadService');
const { apiSuccess, apiError } = require('../utils/response');

const leadController = {
  /**
   * GET /api/leads
   * Protected: List leads with search, filters, and pagination
   */
  async getLeads(req, res, next) {
    try {
      const { search, status, service, source, assignedTo, includeArchived, page, limit } = req.query;
      const result = await leadService.getLeads({
        search,
        status,
        service,
        source,
        assignedTo,
        includeArchived: includeArchived === 'true' || includeArchived === '1',
        page: page || 1,
        limit: limit || 50
      });
      return apiSuccess(res, result.leads || result, 'Leads retrieved successfully.', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/leads/:id
   * Protected: Retrieve one lead with notes and activities
   */
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

  /**
   * POST /api/leads
   * Public or Authenticated: Create inbound lead from website or campaign
   */
  async createLead(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const lead = await leadService.createLead(req.body, ipAddress, userAgent);

      // Public sanitization: return confirmation without exposing internal system notes
      const publicResponse = {
        id: lead.id,
        leadCode: lead.leadCode || lead.lead_code,
        name: lead.name,
        phone: lead.phone,
        service: lead.service || lead.service_name,
        status: lead.status,
        isDuplicate: Boolean(lead.isDuplicateAlert || lead.isDuplicate || lead.is_duplicate),
        isDuplicateAlert: Boolean(lead.isDuplicateAlert || lead.isDuplicate || lead.is_duplicate),
        duplicateOfId: lead.duplicateOfId || lead.duplicate_of_id || null,
        createdAt: lead.createdAt || lead.created_at
      };

      return apiSuccess(
        res,
        publicResponse,
        lead.isDuplicateAlert
          ? 'Repeat inquiry recorded! Our specialist will follow up shortly.'
          : 'Thank you! Your pest control inquiry has been received. Our specialist will call you shortly.',
        201
      );
    } catch (error) {
      if (error.message.includes('required') || error.message.includes('valid')) {
        return apiError(res, error.message, 422);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/leads/:id and PUT /api/leads/:id
   * Protected: Update permitted lead fields
   */
  async updateLead(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await leadService.updateLead(id, req.body, req.user, ipAddress);
      return apiSuccess(res, updated, 'Lead updated successfully.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/leads/:id/status
   * Protected: Update lead status
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return apiError(res, 'Status field is required.', 422);
      }
      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await leadService.updateStatus(id, status, req.user, ipAddress);
      return apiSuccess(res, updated, `Lead status updated to ${status}.`);
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      if (error.message.includes('Invalid status')) {
        return apiError(res, error.message, 422);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/leads/:id/assign
   * Protected: Assign lead to technician or staff member
   */
  async assignLead(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, technicianId, assignedTo } = req.body;
      const targetUserId = userId !== undefined ? userId : assignedTo;
      const targetTechId = technicianId !== undefined ? technicianId : undefined;

      if (targetUserId === undefined && targetTechId === undefined) {
        return apiError(res, 'Please provide userId or technicianId to assign.', 422);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await leadService.assign(
        id,
        { userId: targetUserId, technicianId: targetTechId },
        req.user,
        ipAddress
      );
      return apiSuccess(res, updated, 'Lead assignment updated successfully.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * DELETE /api/leads/:id
   * Protected: Archive / soft-delete lead
   */
  async archiveLead(req, res, next) {
    try {
      const { id } = req.params;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const updated = await leadService.archiveLead(id, req.user, ipAddress);
      return apiSuccess(res, updated, 'Lead archived successfully.');
    } catch (error) {
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * POST /api/leads/:id/notes
   * Protected: Add note to lead
   */
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
      if (error.message.includes('not found')) {
        return apiError(res, error.message, 404);
      }
      next(error);
    }
  }
};

module.exports = leadController;
