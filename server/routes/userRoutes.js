// Universal Pest Control — User & Staff Routes
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/users — List active staff users for assignment
router.get('/', userController.getStaffUsers);

module.exports = router;
