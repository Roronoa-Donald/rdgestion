const BASE_URL = `${window.location.origin}/api`;

function buildQuery(filters = {}) {
  const query = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null) {
      query.append(key, filters[key]);
    }
  });
  return query.toString();
}

/**
 * Envoie une requête HTTP sécurisée avec injection du JWT.
 */
async function request(endpoint, options = {}) {
  // Bloquer les actions d'écriture hors-ligne
  if (!navigator.onLine && options.method && options.method !== 'GET') {
    const err = new Error('Action impossible hors ligne. Veuillez restaurer votre connexion internet pour effectuer des modifications ou valider des ventes.');
    err.code = 'OFFLINE_ERROR';
    throw err;
  }

  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ne pas écraser le Content-Type si nous envoyons du FormData (upload photo)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    // Déconnexion automatique si token expiré / invalide
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      localStorage.clear();
      window.dispatchEvent(new CustomEvent('auth-expired'));
      throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
    }

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const err = new Error(data.message || 'Une erreur est survenue.');
      err.statusCode = response.status;
      err.code = data.error || 'SERVER_ERROR';
      err.details = data.details || null;
      throw err;
    }

    return data;
  } catch (error) {
    console.error(`Erreur API [${endpoint}] :`, error);
    throw error;
  }
}

async function requestText(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
    localStorage.clear();
    window.dispatchEvent(new CustomEvent('auth-expired'));
    throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data.message || 'Une erreur est survenue.');
    err.statusCode = response.status;
    err.code = data.error || 'SERVER_ERROR';
    throw err;
  }

  return response.text();
}

export const API = {
  auth: {
    async register(payload) {
      return request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async login(payload) {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async createVendor(payload) {
      return request('/auth/vendors', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
  },

  products: {
    async list(filters = {}) {
      const queryString = buildQuery(filters);
      return request(`/products${queryString ? '?' + queryString : ''}`);
    },
    async listTrash() {
      return request('/products/trash');
    },
    async get(id) {
      return request(`/products/${id}`);
    },
    async create(formData) {
      return request('/products', {
        method: 'POST',
        body: formData // multipart/form-data
      });
    },
    async update(id, formData) {
      return request(`/products/${id}`, {
        method: 'PUT',
        body: formData // multipart/form-data
      });
    },
    async delete(id) {
      return request(`/products/${id}`, {
        method: 'DELETE'
      });
    },
    async restore(id) {
      return request(`/products/${id}/restore`, {
        method: 'POST'
      });
    }
  },

  categories: {
    async list() {
      return request('/categories');
    },
    async seed(sectors = []) {
      return request('/categories/seed', {
        method: 'POST',
        body: JSON.stringify({ sectors })
      });
    },
    async create(name) {
      return request('/categories', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
    },
    async delete(id) {
      return request(`/categories/${id}`, {
        method: 'DELETE'
      });
    }
  },

  sales: {
    async create(payload) {
      return request('/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async list(filters = {}) {
      const queryString = buildQuery(filters);
      return request(`/sales${queryString ? '?' + queryString : ''}`);
    },
    async get(id) {
      return request(`/sales/${id}`);
    },
    async cancel(id) {
      return request(`/sales/${id}/cancel`, {
        method: 'POST'
      });
    },
    async openTicket(id) {
      const ticketWindow = window.open('', '_blank', 'width=350,height=600');
      if (!ticketWindow) {
        throw new Error('Le navigateur a bloqué la fenêtre d’impression. Autorisez les popups pour RDGESTION.');
      }

      ticketWindow.document.write('<!doctype html><title>Ticket RDGESTION</title><p style="font-family: sans-serif;">Préparation du ticket...</p>');

      try {
        const html = await requestText(`/sales/${id}/ticket`);
        ticketWindow.document.open();
        ticketWindow.document.write(html);
        ticketWindow.document.close();
      } catch (error) {
        ticketWindow.close();
        throw error;
      }
    }
  },

  dashboard: {
    async getStats() {
      return request('/dashboard');
    }
  },

  logs: {
    async list(filters = {}) {
      const queryString = buildQuery(filters);
      return request(`/logs${queryString ? '?' + queryString : ''}`);
    }
  },

  notifications: {
    async list(all = false) {
      return request(`/notifications?all=${all}`);
    },
    async read(id) {
      return request(`/notifications/${id}/read`, {
        method: 'PATCH'
      });
    },
    async readAll() {
      return request('/notifications/read-all', {
        method: 'POST'
      });
    }
  },

  settings: {
    async get() {
      return request('/settings');
    },
    async update(payload) {
      return request('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    },
    async getProfile() {
      return request('/settings/profile');
    },
    async updateProfile(payload) {
      return request('/settings/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    },
    async listVendors() {
      return request('/settings/vendors');
    },
    async toggleVendor(id, is_active) {
      return request(`/settings/vendors/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active })
      });
    }
  },

  admin: {
    async listTenants(filters = {}) {
      const queryString = buildQuery(filters);
      return request(`/admin/tenants${queryString ? '?' + queryString : ''}`);
    },
    async toggleTenant(id, is_active) {
      return request(`/admin/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active })
      });
    },
    async activateSubscription(tenantId, billing_type) {
      return request(`/admin/subscriptions/${tenantId}/activate`, {
        method: 'POST',
        body: JSON.stringify({ billing_type })
      });
    },
    async getReferrals() {
      return request('/admin/referrals');
    }
  }
};
