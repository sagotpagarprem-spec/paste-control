// Universal Pest Control — Master CMS Routes (Phase 4)
const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { verifyToken } = require('../utils/jwt');
const { query } = require('../config/database');

// Middleware to detect admin user if token is provided without failing public requests
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.upc_token) {
    token = req.cookies.upc_token;
  }

  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded && decoded.id) {
        const rows = await query(
          `SELECT u.id, u.name, u.email, GROUP_CONCAT(DISTINCT r.name) as role_names
           FROM users u
           LEFT JOIN user_roles ur ON u.id = ur.user_id
           LEFT JOIN roles r ON ur.role_id = r.id
           WHERE u.id = ? AND u.is_active = TRUE
           GROUP BY u.id`,
          [decoded.id]
        );
        if (rows.length > 0) {
          const user = rows[0];
          req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            roles: user.role_names ? user.role_names.split(',') : ['admin']
          };
        }
      }
    } catch (e) {
      // Ignored for optional auth
    }
  }
  next();
}

// ---------------------------------------------------------------------
// 1. SERVICES
// ---------------------------------------------------------------------
// Public list & detail
router.get('/services', optionalAuth, cmsController.getServices);
router.get('/services/slug/:slug', optionalAuth, (req, res, next) => {
  req.params.idOrSlug = req.params.slug;
  cmsController.getServiceBySlugOrId(req, res, next);
});
router.get('/services/:idOrSlug', optionalAuth, cmsController.getServiceBySlugOrId);

// Admin-only modification
router.post('/services', authenticateToken, requireRole('admin'), cmsController.createService);
router.put('/services/:id', authenticateToken, requireRole('admin'), cmsController.updateService);
router.delete('/services/:id', authenticateToken, requireRole('admin'), cmsController.deleteService);

// ---------------------------------------------------------------------
// 2. OFFERS
// ---------------------------------------------------------------------
// Public list & detail
router.get('/offers', optionalAuth, cmsController.getOffers);
router.get('/offers/:id', optionalAuth, cmsController.getOfferById);

// Admin-only modification
router.post('/offers', authenticateToken, requireRole('admin'), cmsController.createOffer);
router.put('/offers/:id', authenticateToken, requireRole('admin'), cmsController.updateOffer);
router.delete('/offers/:id', authenticateToken, requireRole('admin'), cmsController.deleteOffer);

// ---------------------------------------------------------------------
// 3. REVIEWS
// ---------------------------------------------------------------------
// Public list (only APPROVED reviews returned for public; full queue for admin)
router.get('/reviews', optionalAuth, cmsController.getReviews);
router.get('/reviews/:id', optionalAuth, cmsController.getReviewById);

// Public submission (defaults to PENDING status)
router.post('/reviews', optionalAuth, cmsController.createReview);

// Admin-only moderation & management
router.put('/reviews/:id/status', authenticateToken, requireRole('admin'), cmsController.updateReviewStatus);
router.put('/reviews/:id', authenticateToken, requireRole('admin'), cmsController.updateReview);
router.delete('/reviews/:id', authenticateToken, requireRole('admin'), cmsController.deleteReview);

// ---------------------------------------------------------------------
// 4. BLOG
// ---------------------------------------------------------------------
// Public list (only PUBLISHED articles returned for public; drafts/archived for admin)
router.get('/blog', optionalAuth, cmsController.getBlogPosts);
router.get('/blog/slug/:slug', optionalAuth, (req, res, next) => {
  req.params.slugOrId = req.params.slug;
  cmsController.getBlogPostBySlugOrId(req, res, next);
});
router.get('/blog/:slugOrId', optionalAuth, cmsController.getBlogPostBySlugOrId);

// Admin-only management
router.post('/blog', authenticateToken, requireRole('admin'), cmsController.createBlogPost);
router.put('/blog/:id', authenticateToken, requireRole('admin'), cmsController.updateBlogPost);
router.delete('/blog/:id', authenticateToken, requireRole('admin'), cmsController.deleteBlogPost);

// ---------------------------------------------------------------------
// 5. SERVICE AREAS
// ---------------------------------------------------------------------
// Public list (only ACTIVE areas returned for public)
router.get('/service-areas', optionalAuth, cmsController.getServiceAreas);
router.get('/service-areas/:id', optionalAuth, cmsController.getServiceAreaById);

// Admin-only management
router.post('/service-areas', authenticateToken, requireRole('admin'), cmsController.createServiceArea);
router.put('/service-areas/:id', authenticateToken, requireRole('admin'), cmsController.updateServiceArea);
router.delete('/service-areas/:id', authenticateToken, requireRole('admin'), cmsController.deleteServiceArea);

// ---------------------------------------------------------------------
// 6. ADMIN CMS OVERVIEW
// ---------------------------------------------------------------------
router.get('/admin/overview', authenticateToken, requireRole('admin'), cmsController.getCmsOverview);

module.exports = router;
