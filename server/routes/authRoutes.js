// Universal Pest Control — Auth Routes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, validateLogin } = require('../validators/validate');

// POST /api/auth/login — Admin & Staff Login
router.post('/login', authLimiter, validate(validateLogin), authController.login);

// POST /api/auth/logout — Sign out & clear session
router.post('/logout', authController.logout);

// GET /api/auth/me — Current authenticated user profile
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
