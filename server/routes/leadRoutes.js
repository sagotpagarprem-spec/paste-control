// Universal Pest Control — Lead CRM Routes
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');
const { publicLeadLimiter } = require('../middleware/rateLimiter');
const { validate, validateLeadCreate } = require('../validators/validate');

// 1. Public Inbound Lead Submission
// POST /api/leads — Create a lead from public website or external campaign
router.post('/', publicLeadLimiter, validate(validateLeadCreate), leadController.createLead);

// 2. Protected CRM Administrative Endpoints (Authentication Required)
// GET /api/leads — List leads for authorized administrators with pagination, search, and filters
router.get('/', authenticateToken, requirePermission('leads:read'), leadController.getLeads);

// GET /api/leads/:id — Retrieve single lead details with timeline and notes
router.get('/:id', authenticateToken, requirePermission('leads:read'), leadController.getLeadById);

// PATCH /api/leads/:id & PUT /api/leads/:id — Update permitted lead fields
router.patch('/:id', authenticateToken, requirePermission('leads:update'), leadController.updateLead);
router.put('/:id', authenticateToken, requirePermission('leads:update'), leadController.updateLead);

// PATCH /api/leads/:id/status — Update lead status (NEW, CONTACTED, QUALIFIED, BOOKED, COMPLETED, LOST)
router.patch('/:id/status', authenticateToken, requirePermission('leads:update'), leadController.updateStatus);

// PATCH /api/leads/:id/assign — Assign technician or staff to lead
router.patch('/:id/assign', authenticateToken, requirePermission('leads:update'), leadController.assignLead);

// DELETE /api/leads/:id — Soft-delete / Archive lead
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), leadController.archiveLead);

// POST /api/leads/:id/notes — Add internal administrative note
router.post('/:id/notes', authenticateToken, requirePermission('leads:update'), leadController.addNote);

module.exports = router;
