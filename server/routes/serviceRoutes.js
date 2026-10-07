// Universal Pest Control — Service Routes
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Public catalog access
// GET /api/services
router.get('/', serviceController.getServices);

// GET /api/services/:id
router.get('/:id', serviceController.getServiceById);

// Protected Admin service management
// POST /api/services
router.post('/', authenticateToken, requireRole('admin'), serviceController.createService);

module.exports = router;
