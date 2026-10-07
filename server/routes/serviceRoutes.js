// Universal Pest Control — Service Routes (CRUD)
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

// PUT /api/services/:id
router.put('/:id', authenticateToken, requireRole('admin'), serviceController.updateService);

// DELETE /api/services/:id
router.delete('/:id', authenticateToken, requireRole('admin'), serviceController.deleteService);

module.exports = router;
