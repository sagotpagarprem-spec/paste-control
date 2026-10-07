// Universal Pest Control — Master CMS Controller (Phase 4)
const serviceModel = require('../models/serviceModel');
const offerModel = require('../models/offerModel');
const reviewModel = require('../models/reviewModel');
const blogModel = require('../models/blogModel');
const serviceAreaModel = require('../models/serviceAreaModel');
const { apiSuccess, apiError } = require('../utils/response');

const cmsController = {
  // ==================== 1. SERVICES ====================
  async getServices(req, res, next) {
    try {
      const isAdmin = Boolean(req.user);
      const activeOnly = !isAdmin && req.query.all !== 'true';
      const { category, status, search } = req.query;

      const services = await serviceModel.findAll({
        activeOnly,
        category,
        status: !isAdmin ? 'ACTIVE' : status,
        search
      });

      return apiSuccess(res, services, 'Services retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getServiceBySlugOrId(req, res, next) {
    try {
      const { idOrSlug } = req.params;
      const service = await serviceModel.findById(idOrSlug);
      if (!service) {
        return apiError(res, 'Service not found.', 404);
      }
      return apiSuccess(res, service, 'Service retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createService(req, res, next) {
    try {
      if (!req.body.name) {
        return apiError(res, 'Service name is required.', 400);
      }
      const service = await serviceModel.create(req.body);
      return apiSuccess(res, service, 'Service created successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateService(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await serviceModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Service not found.', 404);
      }
      return apiSuccess(res, updated, 'Service updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteService(req, res, next) {
    try {
      const { id } = req.params;
      const result = await serviceModel.delete(id);
      if (!result) {
        return apiError(res, 'Service not found.', 404);
      }
      return apiSuccess(res, result, 'Service archived/deleted successfully.');
    } catch (error) {
      next(error);
    }
  },

  // ==================== 2. OFFERS ====================
  async getOffers(req, res, next) {
    try {
      const isAdmin = Boolean(req.user);
      const activeOnly = !isAdmin && req.query.all !== 'true';
      const { status, search } = req.query;

      const offers = await offerModel.findAll({
        activeOnly,
        status: !isAdmin ? 'ACTIVE' : status,
        search
      });

      return apiSuccess(res, offers, 'Offers retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getOfferById(req, res, next) {
    try {
      const { id } = req.params;
      const offer = await offerModel.findById(id);
      if (!offer) {
        return apiError(res, 'Offer not found.', 404);
      }
      return apiSuccess(res, offer, 'Offer retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createOffer(req, res, next) {
    try {
      if (!req.body.title || !req.body.discount) {
        return apiError(res, 'Title and discount are required.', 400);
      }
      const offer = await offerModel.create(req.body);
      return apiSuccess(res, offer, 'Offer created successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateOffer(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await offerModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Offer not found.', 404);
      }
      return apiSuccess(res, updated, 'Offer updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteOffer(req, res, next) {
    try {
      const { id } = req.params;
      const result = await offerModel.delete(id);
      if (!result) {
        return apiError(res, 'Offer not found.', 404);
      }
      return apiSuccess(res, result, 'Offer deleted successfully.');
    } catch (error) {
      next(error);
    }
  },

  // ==================== 3. REVIEWS ====================
  async getReviews(req, res, next) {
    try {
      const isAdmin = Boolean(req.user);
      // Public rule: only APPROVED reviews appear publicly
      const publicOnly = !isAdmin && req.query.all !== 'true';
      const { status, featured, search } = req.query;

      const reviews = await reviewModel.findAll({
        publicOnly,
        status: !isAdmin ? 'APPROVED' : status,
        featuredOnly: featured === 'true',
        search
      });

      return apiSuccess(res, reviews, 'Reviews retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getReviewById(req, res, next) {
    try {
      const { id } = req.params;
      const review = await reviewModel.findById(id);
      if (!review) {
        return apiError(res, 'Review not found.', 404);
      }
      return apiSuccess(res, review, 'Review retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createReview(req, res, next) {
    try {
      if (!req.body.customer || !req.body.review) {
        return apiError(res, 'Customer name and review content are required.', 400);
      }

      // If submitted by anonymous public, default to PENDING. If admin, allow explicit status.
      const isAdmin = Boolean(req.user);
      const data = {
        ...req.body,
        status: isAdmin && req.body.status ? req.body.status : (req.body.status || 'PENDING')
      };

      const review = await reviewModel.create(data);
      return apiSuccess(res, review, 'Review submitted successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateReviewStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return apiError(res, 'Status is required (PENDING, APPROVED, REJECTED).', 400);
      }
      const updated = await reviewModel.updateStatus(id, status);
      if (!updated) {
        return apiError(res, 'Review not found.', 404);
      }
      return apiSuccess(res, updated, `Review status updated to ${status}.`);
    } catch (error) {
      next(error);
    }
  },

  async updateReview(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await reviewModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Review not found.', 404);
      }
      return apiSuccess(res, updated, 'Review updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteReview(req, res, next) {
    try {
      const { id } = req.params;
      const result = await reviewModel.delete(id);
      if (!result) {
        return apiError(res, 'Review not found.', 404);
      }
      return apiSuccess(res, result, 'Review deleted successfully.');
    } catch (error) {
      next(error);
    }
  },

  // ==================== 4. BLOG ====================
  async getBlogPosts(req, res, next) {
    try {
      const isAdmin = Boolean(req.user);
      // Public rule: only PUBLISHED blog posts appear publicly
      const publicOnly = !isAdmin && req.query.all !== 'true';
      const { status, category, search } = req.query;

      const posts = await blogModel.findAll({
        publicOnly,
        status: !isAdmin ? 'PUBLISHED' : status,
        category,
        search
      });

      return apiSuccess(res, posts, 'Blog posts retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getBlogPostBySlugOrId(req, res, next) {
    try {
      const { slugOrId } = req.params;
      const post = await blogModel.findById(slugOrId);
      if (!post) {
        return apiError(res, 'Article not found.', 404);
      }

      // If not admin, hide drafts or archived
      if (!req.user && post.status !== 'PUBLISHED') {
        return apiError(res, 'Article not found or not published.', 404);
      }

      return apiSuccess(res, post, 'Article retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createBlogPost(req, res, next) {
    try {
      if (!req.body.title || !req.body.content) {
        return apiError(res, 'Title and article content are required.', 400);
      }
      const post = await blogModel.create(req.body);
      return apiSuccess(res, post, 'Blog post created successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateBlogPost(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await blogModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Article not found.', 404);
      }
      return apiSuccess(res, updated, 'Blog post updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteBlogPost(req, res, next) {
    try {
      const { id } = req.params;
      const result = await blogModel.delete(id);
      if (!result) {
        return apiError(res, 'Article not found.', 404);
      }
      return apiSuccess(res, result, 'Blog post deleted successfully.');
    } catch (error) {
      next(error);
    }
  },

  // ==================== 5. SERVICE AREAS ====================
  async getServiceAreas(req, res, next) {
    try {
      const isAdmin = Boolean(req.user);
      const publicOnly = !isAdmin && req.query.all !== 'true';
      const { status, city, search } = req.query;

      const areas = await serviceAreaModel.findAll({
        publicOnly,
        status: !isAdmin ? 'ACTIVE' : status,
        city,
        search
      });

      return apiSuccess(res, areas, 'Service areas retrieved successfully.');
    } catch (error) {
      next(error);
    }
  },

  async getServiceAreaById(req, res, next) {
    try {
      const { id } = req.params;
      const area = await serviceAreaModel.findById(id);
      if (!area) {
        return apiError(res, 'Service area not found.', 404);
      }
      return apiSuccess(res, area, 'Service area retrieved.');
    } catch (error) {
      next(error);
    }
  },

  async createServiceArea(req, res, next) {
    try {
      if (!req.body.area) {
        return apiError(res, 'Area name is required.', 400);
      }
      const area = await serviceAreaModel.create(req.body);
      return apiSuccess(res, area, 'Service area created successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateServiceArea(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await serviceAreaModel.update(id, req.body);
      if (!updated) {
        return apiError(res, 'Service area not found.', 404);
      }
      return apiSuccess(res, updated, 'Service area updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteServiceArea(req, res, next) {
    try {
      const { id } = req.params;
      const result = await serviceAreaModel.delete(id);
      if (!result) {
        return apiError(res, 'Service area not found.', 404);
      }
      return apiSuccess(res, result, 'Service area deleted successfully.');
    } catch (error) {
      next(error);
    }
  },

  // ==================== 6. CMS STATS OVERVIEW ====================
  async getCmsOverview(req, res, next) {
    try {
      const [services, offers, allReviews, blogs, areas] = await Promise.all([
        serviceModel.findAll(),
        offerModel.findAll(),
        reviewModel.findAll({ status: 'ALL' }),
        blogModel.findAll({ status: 'ALL' }),
        serviceAreaModel.findAll({ status: 'ALL' })
      ]);

      const reviewStats = {
        total: allReviews.length,
        pending: allReviews.filter(r => r.status === 'PENDING').length,
        approved: allReviews.filter(r => r.status === 'APPROVED').length,
        rejected: allReviews.filter(r => r.status === 'REJECTED').length
      };

      const blogStats = {
        total: blogs.length,
        published: blogs.filter(b => b.status === 'PUBLISHED').length,
        draft: blogs.filter(b => b.status === 'DRAFT').length,
        archived: blogs.filter(b => b.status === 'ARCHIVED').length
      };

      return apiSuccess(res, {
        servicesCount: services.length,
        activeServicesCount: services.filter(s => s.status === 'ACTIVE').length,
        offersCount: offers.length,
        activeOffersCount: offers.filter(o => o.status === 'ACTIVE').length,
        reviews: reviewStats,
        blogs: blogStats,
        areasCount: areas.length,
        activeAreasCount: areas.filter(a => a.status === 'ACTIVE').length
      }, 'CMS overview metrics retrieved.');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = cmsController;
