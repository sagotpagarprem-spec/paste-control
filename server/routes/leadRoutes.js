// Universal Pest Control — Lead Routes
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { publicLeadLimiter } = require('../middleware/rateLimiter');
const { validate, validateLeadCreate } = require('../validators/validate');

// Public or Authenticated Inbound Lead Submission
// POST /api/leads
router.post('/', publicLeadLimiter, validate(validateLeadCreate), leadController.createLead);

// Protected CRM Endpoints
// GET /api/leads
router.get('/', authenticateToken, requirePermission('leads:read'), leadController.getLeads);

// GET /api/leads/:id
router.get('/:id', authenticateToken, requirePermission('leads:read'), leadController.getLeadById);

// PUT /api/leads/:id
router.put('/:id', authenticateToken, requirePermission('leads:update'), leadController.updateLead);

// POST /api/leads/:id/notes
router.post('/:id/notes', authenticateToken, requirePermission('leads:update'), leadController.addNote);

module.exports = router;
