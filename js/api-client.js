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

    updateStatus: async (id, status) => {
      return await this.request(`/bookings/${id}/status`, {
        method: 'PUT',
        body: { status }
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
    }
  };

  // Services API
  services = {
    getAll: async (all = false) => {
      return await this.request(`/services${all ? '?all=true' : ''}`, { method: 'GET' });
    },

    getById: async (id) => {
      return await this.request(`/services/${id}`, { method: 'GET' });
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

    markAllRead: async () => {
      return await this.request('/notifications/read-all', { method: 'PUT' });
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
