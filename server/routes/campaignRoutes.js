// Universal Pest Control — Campaign Management Routes (Phase 8)
const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authenticateToken);

// ==========================================
// AD SETS (placed before /:id)
// ==========================================
router.get('/adsets/all', requirePermission('campaigns:read'), campaignController.getAdSets);
router.get('/adsets/:id', requirePermission('campaigns:read'), campaignController.getAdSetById);
router.post('/adsets', requirePermission('campaigns:manage'), campaignController.createAdSet);
router.put('/adsets/:id', requirePermission('campaigns:manage'), campaignController.updateAdSet);
router.patch('/adsets/:id/status', requirePermission('campaigns:manage'), campaignController.updateAdSetStatus);
router.delete('/adsets/:id', requirePermission('campaigns:manage'), campaignController.deleteAdSet);

// ==========================================
// ADS (placed before /:id)
// ==========================================
router.get('/ads/all', requirePermission('campaigns:read'), campaignController.getAds);
router.get('/ads/:id', requirePermission('campaigns:read'), campaignController.getAdById);
router.post('/ads', requirePermission('campaigns:manage'), campaignController.createAd);
router.put('/ads/:id', requirePermission('campaigns:manage'), campaignController.updateAd);
router.patch('/ads/:id/status', requirePermission('campaigns:manage'), campaignController.updateAdStatus);
router.delete('/ads/:id', requirePermission('campaigns:manage'), campaignController.deleteAd);

// ==========================================
// CREATIVES (CONNECTED WITH CREATIVE STUDIO)
// ==========================================
router.get('/creatives/all', requirePermission('campaigns:read'), campaignController.getCreatives);
router.get('/creatives/:id', requirePermission('campaigns:read'), campaignController.getCreativeById);
router.post('/creatives', requirePermission('campaigns:manage'), campaignController.createCreative);
router.put('/creatives/:id', requirePermission('campaigns:manage'), campaignController.updateCreative);
router.delete('/creatives/:id', requirePermission('campaigns:manage'), campaignController.deleteCreative);

// ==========================================
// CAMPAIGNS
// ==========================================
router.get('/', requirePermission('campaigns:read'), campaignController.getCampaigns);
router.get('/:id', requirePermission('campaigns:read'), campaignController.getCampaignById);
router.post('/', requirePermission('campaigns:manage'), campaignController.createCampaign);
router.put('/:id', requirePermission('campaigns:manage'), campaignController.updateCampaign);
router.patch('/:id/status', requirePermission('campaigns:manage'), campaignController.updateStatus);
router.post('/:id/sync', requirePermission('campaigns:manage'), campaignController.syncMetrics);
router.get('/:id/performance', requirePermission('campaigns:read'), campaignController.getPerformance);
router.delete('/:id', requirePermission('campaigns:manage'), campaignController.deleteCampaign);

module.exports = router;
