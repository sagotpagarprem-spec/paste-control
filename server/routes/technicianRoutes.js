// Universal Pest Control — Technician Routes
const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');

router.use(authenticateToken);

// GET /api/technicians
router.get('/', requirePermission('technicians:read'), technicianController.getTechnicians);

// PUT /api/technicians/:id/status
router.put('/:id/status', requirePermission('technicians:manage'), technicianController.updateStatus);

// POST /api/technicians
router.post('/', requireRole('admin'), technicianController.createTechnician);

module.exports = router;
