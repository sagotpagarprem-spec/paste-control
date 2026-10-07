// Universal Pest Control — Customer Routes
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

// Protected Customer Management
router.use(authenticateToken);

// GET /api/customers
router.get('/', requirePermission('customers:read'), customerController.getCustomers);

// GET /api/customers/:id
router.get('/:id', requirePermission('customers:read'), customerController.getCustomerById);

// POST /api/customers
router.post('/', requirePermission('customers:manage'), customerController.createCustomer);

module.exports = router;
