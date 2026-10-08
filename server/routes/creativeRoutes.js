// Universal Pest Control — AI Creative Studio Routes (Phase 9)
const express = require('express');
const router = express.Router();
const aiCreativeController = require('../controllers/aiCreativeController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authenticateToken);

// Generate creative assets (AI Engine)
// POST /api/creatives/ai-generate
router.post('/ai-generate', requirePermission('creatives:generate'), aiCreativeController.generate);

// Save draft
// POST /api/creatives/ai-save
router.post('/ai-save', requirePermission('creatives:generate'), aiCreativeController.save);

// List saved generations
// GET /api/creatives/ai-generations
router.get('/ai-generations', requirePermission('creatives:generate'), aiCreativeController.list);

// Approve & Sync to Meta Studio
// POST /api/creatives/ai-approve/:id
router.post('/ai-approve/:id', requirePermission('creatives:generate'), aiCreativeController.approve);

module.exports = router;
