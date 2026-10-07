// Universal Pest Control — Technician Routes (Phase 5)
const express = require('express');
const router = express.Router();
const technicianController = require('../controllers/technicianController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');

// 1. Jobs schedule & Technician actions (accessible by technician themselves or management)
router.get('/:id/jobs', authenticateToken, technicianController.getTechnicianJobs);
router.put('/:id/jobs/:bookingId/status', authenticateToken, technicianController.updateJobStatus);
router.put('/:id/availability', authenticateToken, technicianController.updateAvailability);

// 2. Technician Directory & Profiles
router.get('/', authenticateToken, requirePermission('technicians:read'), technicianController.getTechnicians);
router.get('/:id', authenticateToken, requirePermission('technicians:read'), technicianController.getTechnicianById);

// 3. Technician Management & Administration
router.post('/', authenticateToken, requirePermission('technicians:manage'), technicianController.createTechnician);
router.put('/:id', authenticateToken, requirePermission('technicians:manage'), technicianController.updateTechnician);
router.put('/:id/status', authenticateToken, requirePermission('technicians:manage'), technicianController.updateStatus);
router.delete('/:id', authenticateToken, requireRole('admin'), technicianController.deleteTechnician);

module.exports = router;
