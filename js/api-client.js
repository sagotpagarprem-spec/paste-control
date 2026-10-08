/* =====================================================================
   UNIVERSAL PEST CONTROL — API CLIENT LAYER
   Unified HTTP Client for Authentication, CRM, Bookings & Dispatch
   ===================================================================== */

class UPCApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.tokenKey = 'upc_auth_token';
    this.userKey = 'upc_auth_user';
  }

  // Token & Session Storage
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setSession(token, user) {
    if (token) localStorage.setItem(this.tokenKey, token);
    if (user) localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clearSession() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  getUser() {
    try {
      const u = localStorage.getItem(this.userKey);
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  isAuthenticated() {
    const token = this.getToken();
    return Boolean(token && token.trim().length > 10);
  }

  // Core Request Method
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          this.clearSession();
          if (window.location.pathname.includes('admin')) {
            window.location.href = 'login.html';
          }
        }
        const error = new Error((data && data.message) || `HTTP Error ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  // Authentication API
  auth = {
    login: async (email, password) => {
      const res = await this.request('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      if (res && res.data && res.data.token) {
        this.setSession(res.data.token, res.data.user);
      }
      return res;
    },

    logout: async () => {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch (e) {
        // Ignore logout network errors
      } finally {
        this.clearSession();
      }
    },

    getMe: async () => {
      const res = await this.request('/auth/me', { method: 'GET' });
      if (res && res.data) {
        localStorage.setItem(this.userKey, JSON.stringify(res.data));
      }
      return res;
    },

    isAuthenticated: () => this.isAuthenticated(),
    getUser: () => this.getUser(),
    getToken: () => this.getToken()
  };

  // Leads CRM API
  leads = {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/leads${query ? `?${query}` : ''}`, { method: 'GET' });
    },

    getById: async (id) => {
      return await this.request(`/leads/${id}`, { method: 'GET' });
    },

    create: async (leadData) => {
      return await this.request('/leads', {
        method: 'POST',
        body: leadData
      });
    },

    update: async (id, updateData) => {
      return await this.request(`/leads/${id}`, {
        method: 'PUT',
        body: updateData
      });
    },

    addNote: async (id, note) => {
      return await this.request(`/leads/${id}/notes`, {
        method: 'POST',
        body: { note }
      });
    }
  };

  // Bookings API
  bookings = {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/bookings${query ? `?${query}` : ''}`, { method: 'GET' });
    },

    getById: async (id) => {
      return await this.request(`/bookings/${id}`, { method: 'GET' });
    },

    create: async (bookingData) => {
      return await this.request('/bookings', {
        method: 'POST',
        body: bookingData
      });
    },

    update: async (id, data) => {
      return await this.request(`/bookings/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    updateStatus: async (id, status) => {
      return await this.request(`/bookings/${id}/status`, {
        method: 'PUT',
        body: { status }
      });
    },

    assign: async (id, technicianId) => {
      return await this.request(`/bookings/${id}/assign`, {
        method: 'POST',
        body: { technicianId }
      });
    },

    getTracking: async (idOrCode) => {
      return await this.request(`/bookings/${idOrCode}/tracking`, {
        method: 'GET'
      });
    },

    delete: async (id) => {
      return await this.request(`/bookings/${id}`, {
        method: 'DELETE'
      });
    }
  };

  // Technicians & Dispatch API (Phase 5)
  technicians = {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/technicians${query ? `?${query}` : ''}`, { method: 'GET' });
    },

    getById: async (id) => {
      return await this.request(`/technicians/${id}`, { method: 'GET' });
    },

    create: async (data) => {
      return await this.request('/technicians', {
        method: 'POST',
        body: data
      });
    },

    update: async (id, data) => {
      return await this.request(`/technicians/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    updateStatus: async (id, status) => {
      return await this.request(`/technicians/${id}/status`, {
        method: 'PUT',
        body: { status }
      });
    },

    updateAvailability: async (id, availability) => {
      return await this.request(`/technicians/${id}/availability`, {
        method: 'PUT',
        body: { availability }
      });
    },

    delete: async (id) => {
      return await this.request(`/technicians/${id}`, {
        method: 'DELETE'
      });
    },

    getJobs: async (id) => {
      return await this.request(`/technicians/${id}/jobs`, { method: 'GET' });
    },

    updateJobStatus: async (technicianId, bookingId, status, notes = '') => {
      return await this.request(`/technicians/${technicianId}/jobs/${bookingId}/status`, {
        method: 'PUT',
        body: { status, notes }
      });
    }
  };

  // Customers API
  customers = {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/customers${query ? `?${query}` : ''}`, { method: 'GET' });
    },

    getById: async (id) => {
      return await this.request(`/customers/${id}`, { method: 'GET' });
    },

    create: async (customerData) => {
      return await this.request('/customers', {
        method: 'POST',
        body: customerData
      });
    },

    update: async (id, data) => {
      return await this.request(`/customers/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    addNote: async (id, note) => {
      return await this.request(`/customers/${id}/notes`, {
        method: 'POST',
        body: { note }
      });
    },

    addReview: async (id, reviewData) => {
      return await this.request(`/customers/${id}/reviews`, {
        method: 'POST',
        body: reviewData
      });
    }
  };

  // Follow-ups API
  followups = {
    getAll: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/followups${query ? `?${query}` : ''}`, { method: 'GET' });
    },

    getById: async (id) => {
      return await this.request(`/followups/${id}`, { method: 'GET' });
    },

    create: async (data) => {
      return await this.request('/followups', {
        method: 'POST',
        body: data
      });
    },

    update: async (id, data) => {
      return await this.request(`/followups/${id}`, {
        method: 'PUT',
        body: data
      });
    },

    delete: async (id) => {
      return await this.request(`/followups/${id}`, {
        method: 'DELETE'
      });
    }
  };

  // Services API
  services = {
    getAll: async (all = false) => {
      return await this.request(`/services${all ? '?all=true' : ''}`, { method: 'GET' });
    },

    getById: async (id) => {
      return await this.request(`/services/${id}`, { method: 'GET' });
    },

    create: async (data) => {
      return await this.request('/services', { method: 'POST', body: data });
    },

    update: async (id, data) => {
      return await this.request(`/services/${id}`, { method: 'PUT', body: data });
    },

    delete: async (id) => {
      return await this.request(`/services/${id}`, { method: 'DELETE' });
    }
  };

  // Content Management System (CMS) API
  cms = {
    // Services
    getServices: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return await this.request(`/cms/services${q ? `?${q}` : ''}`, { method: 'GET' });
    },
    getService: async (idOrSlug) => {
      return await this.request(`/cms/services/${idOrSlug}`, { method: 'GET' });
    },
    createService: async (data) => {
      return await this.request('/cms/services', { method: 'POST', body: data });
    },
    updateService: async (id, data) => {
      return await this.request(`/cms/services/${id}`, { method: 'PUT', body: data });
    },
    deleteService: async (id) => {
      return await this.request(`/cms/services/${id}`, { method: 'DELETE' });
    },

    // Offers
    getOffers: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return await this.request(`/cms/offers${q ? `?${q}` : ''}`, { method: 'GET' });
    },
    getOffer: async (id) => {
      return await this.request(`/cms/offers/${id}`, { method: 'GET' });
    },
    createOffer: async (data) => {
      return await this.request('/cms/offers', { method: 'POST', body: data });
    },
    updateOffer: async (id, data) => {
      return await this.request(`/cms/offers/${id}`, { method: 'PUT', body: data });
    },
    deleteOffer: async (id) => {
      return await this.request(`/cms/offers/${id}`, { method: 'DELETE' });
    },

    // Reviews
    getReviews: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return await this.request(`/cms/reviews${q ? `?${q}` : ''}`, { method: 'GET' });
    },
    createReview: async (data) => {
      return await this.request('/cms/reviews', { method: 'POST', body: data });
    },
    updateReviewStatus: async (id, status) => {
      return await this.request(`/cms/reviews/${id}/status`, { method: 'PUT', body: { status } });
    },
    updateReview: async (id, data) => {
      return await this.request(`/cms/reviews/${id}`, { method: 'PUT', body: data });
    },
    deleteReview: async (id) => {
      return await this.request(`/cms/reviews/${id}`, { method: 'DELETE' });
    },

    // Blog
    getBlogPosts: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return await this.request(`/cms/blog${q ? `?${q}` : ''}`, { method: 'GET' });
    },
    getBlogPost: async (slugOrId) => {
      return await this.request(`/cms/blog/${slugOrId}`, { method: 'GET' });
    },
    createBlogPost: async (data) => {
      return await this.request('/cms/blog', { method: 'POST', body: data });
    },
    updateBlogPost: async (id, data) => {
      return await this.request(`/cms/blog/${id}`, { method: 'PUT', body: data });
    },
    deleteBlogPost: async (id) => {
      return await this.request(`/cms/blog/${id}`, { method: 'DELETE' });
    },

    // Service Areas
    getServiceAreas: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return await this.request(`/cms/service-areas${q ? `?${q}` : ''}`, { method: 'GET' });
    },
    getServiceArea: async (id) => {
      return await this.request(`/cms/service-areas/${id}`, { method: 'GET' });
    },
    createServiceArea: async (data) => {
      return await this.request('/cms/service-areas', { method: 'POST', body: data });
    },
    updateServiceArea: async (id, data) => {
      return await this.request(`/cms/service-areas/${id}`, { method: 'PUT', body: data });
    },
    deleteServiceArea: async (id) => {
      return await this.request(`/cms/service-areas/${id}`, { method: 'DELETE' });
    },

    // Overview Stats
    getOverview: async () => {
      return await this.request('/cms/admin/overview', { method: 'GET' });
    }
  };

  // Technicians API
  technicians = {
    getAll: async () => {
      return await this.request('/technicians', { method: 'GET' });
    },

    updateStatus: async (id, status) => {
      return await this.request(`/technicians/${id}/status`, {
        method: 'PUT',
        body: { status }
      });
    }
  };

  // Notifications API
  notifications = {
    getAll: async () => {
      return await this.request('/notifications', { method: 'GET' });
    },

    markRead: async (id) => {
      return await this.request(`/notifications/${id}/read`, { method: 'PUT' });
    },

    markAllRead: async () => {
      return await this.request('/notifications/read-all', { method: 'PUT' });
    }
  };

  // Users & Staff API
  users = {
    getStaff: async () => {
      return await this.request('/users', { method: 'GET' });
    }
  };

  // WhatsApp Business Hub API (Phase 6)
  whatsapp = {
    getConversations: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return await this.request(`/whatsapp/conversations${q ? `?${q}` : ''}`, { method: 'GET' });
    },

    getMessages: async (phone, params = {}) => {
      const clean = encodeURIComponent(phone);
      const q = new URLSearchParams(params).toString();
      return await this.request(`/whatsapp/messages/${clean}${q ? `?${q}` : ''}`, { method: 'GET' });
    },

    getTemplates: async (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return await this.request(`/whatsapp/templates${q ? `?${q}` : ''}`, { method: 'GET' });
    },

    sendTemplate: async (data) => {
      return await this.request('/whatsapp/send-template', { method: 'POST', body: data });
    },

    sendMessage: async (data) => {
      return await this.request('/whatsapp/send-message', { method: 'POST', body: data });
    },

    updateStatus: async (id, status, errorMessage = null) => {
      return await this.request(`/whatsapp/messages/${id}/status`, {
        method: 'PATCH',
        body: { status, errorMessage }
      });
    }
  };

  // Health API
  health = {
    check: async () => {
      return await this.request('/health', { method: 'GET' });
    }
  };
}

// Global Singleton Instance
window.upcApi = new UPCApiClient();
