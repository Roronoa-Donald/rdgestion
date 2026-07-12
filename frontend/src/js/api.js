const BASE_URL = `${window.location.origin}/api`;
import { LoadingIndicator } from './utils/ui.js';

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
  // Ne pas définir Content-Type: application/json si pas de body (PUT/DELETE sans body)
  if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers,
  };

  try {
    LoadingIndicator.show();

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
  } finally {
    LoadingIndicator.hide();
  }
}

async function requestText(endpoint, options = {}) {
  LoadingIndicator.show();
  try {
    const token = localStorage.getItem('token');
    const headers = {
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Bloquer les actions d'écriture hors-ligne
    if (!navigator.onLine && options.method && options.method !== 'GET') {
      const err = new Error('Action impossible hors ligne. Veuillez restaurer votre connexion internet.');
      err.code = 'OFFLINE_ERROR';
      throw err;
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
  } catch (error) {
    console.error(`Erreur API [${endpoint}] :`, error);
    throw error;
  } finally {
    LoadingIndicator.hide();
  }
}

/**
 * Télécharge un fichier binaire depuis l'API (exports PDF/Excel) en utilisant
 * le JWT stocké en localStorage, puis déclenche le téléchargement navigateur.
 * Décode le nom du fichier depuis l'en-tête Content-Disposition si présent.
 *
 * @param {string} endpoint — chemin relatif (ex: '/exports/sales?format=xlsx')
 */
async function downloadExport(endpoint) {
  LoadingIndicator.show();
  try {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, { headers });

    if (response.status === 401) {
      localStorage.clear();
      window.dispatchEvent(new CustomEvent('auth-expired'));
      throw new Error('Votre session a expiré. Veuillez vous reconnecter.');
    }

    if (!response.ok) {
      let message = `Erreur ${response.status}`;
      try {
        const data = await response.json();
        message = data.message || data.error || message;
      } catch (_) { /* réponse binaire d'erreur: ignorer */ }
      const err = new Error(message);
      err.statusCode = response.status;
      throw err;
    }

    const blob = await response.blob();

    // Déduire le nom de fichier depuis Content-Disposition
    const cd = response.headers.get('Content-Disposition') || '';
    let filename = `export-${Date.now()}`;
    const m = cd.match(/filename="([^"]+)"/);
    if (m && m[1]) {
      filename = m[1];
    } else {
      const ext = (response.headers.get('Content-Type') || '').includes('pdf') ? 'pdf' : 'xlsx';
      filename = `export-${Date.now()}.${ext}`;
    }

    // Déclencher le téléchargement côté navigateur
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Libérer la mémoire après un court délai (Safari)
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true, filename };
  } catch (error) {
    console.error(`Erreur API [${endpoint}] :`, error);
    throw error;
  } finally {
    LoadingIndicator.hide();
  }
}

export const API = {
  auth: {
    async login(payload) {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async register(payload) {
      return request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async logout() {
      return request('/auth/logout', {
        method: 'POST'
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
    },
    async stockMovement(productId, payload) {
      return request(`/products/${productId}/stock-movements`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async listStockMovements(productId, filters = {}) {
      const queryString = buildQuery(filters);
      return request(`/products/${productId}/stock-movements${queryString ? '?' + queryString : ''}`);
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
      // Ouvrir la fenêtre SYNCHRONOUSMENT avant tout await pour conserver
      // le contexte "user gesture" (sinon le navigateur bloque le popup).
      const ticketWindow = window.open('', '_blank', 'width=350,height=600');
      if (!ticketWindow) {
        throw new Error('Le navigateur a bloqué la fenêtre d’impression. Autorisez les popups pour RDGESTION.');
      }

      ticketWindow.document.write('<!doctype html><html><head><title>Ticket RDGESTION</title><style>body{font-family:sans-serif;text-align:center;padding:40px;color:#888;}p{animation:pulse 1s infinite}@keyframes pulse{0%{opacity:.4}50%{opacity:1}100%{opacity:.4}}</style></head><body><p>Préparation du ticket…</p></body></html>');

      try {
        const html = await requestText(`/sales/${id}/ticket`);
        ticketWindow.document.open();
        ticketWindow.document.write(html);
        ticketWindow.document.close();
      } catch (error) {
        ticketWindow.close();
        throw error;
      }
    },
    async getTicketHtml(id) {
      return requestText(`/sales/${id}/ticket`);
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
    },
    async getSubscription() {
      return request('/admin/subscriptions/current');
    }
  },
  payments: {
    /**
     * Crée un intent de paiement FedaPay et retourne l'URL de checkout.
     * @param {number} amount - Montant en FCFA
     * @param {string} description - Description du paiement
     * @returns {{ intent: { checkout_url: string, id: string, status: string } }}
     */
    async createIntent(amount, description = 'Abonnement PRO') {
      return request('/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({ amount, description })
      });
    }
  },
  exports: {
    /**
     * Exporte le catalogue produits (xlsx|pdf).
     */
    async products(format = 'xlsx') {
      return downloadExport(`/exports/products?format=${encodeURIComponent(format)}`);
    },
    /**
     * Exporte l'historique des ventes en CSV (généré côté client pour éviter les timeouts serverless).
     * @param {string} format 'csv' (ignoré, toujours CSV)
     * @param {object} range { from, to } dates ISO 'YYYY-MM-DD'
     */
    async sales(format = 'csv', range = {}) {
      // Récupérer toutes les ventes via l'API JSON par lots de 100 (limite API)
      const limit = 100;
      let allSales = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('page', String(page));
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);

        const data = await request(`/sales?${params.toString()}`);
        const sales = data?.data?.sales || [];
        allSales = allSales.concat(sales);

        const total = data?.data?.pagination?.total || 0;
        hasMore = allSales.length < total && sales.length === limit;
        page++;
      }

      if (allSales.length === 0) {
        throw new Error('Aucune vente à exporter sur cette période.');
      }

      // Générer le CSV
      const BOM = '\uFEFF'; // BOM pour qu'Excel reconnaisse l'UTF-8
      const headers = ['Numéro', 'Date', 'Vendeur', 'Articles', 'Quantité', 'Total (FCFA)', 'Paiement', 'Statut'];
      const rows = allSales.map(s => {
        const items = (s.items || []).map(it => `${it.product_name || it.product_id} x${it.quantity}`).join('; ');
        const date = new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return [
          s.sale_number || '',
          date,
          s.seller_username || '',
          items,
          (s.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0),
          (s.total_amount || 0).toFixed(0),
          s.payment_method || '',
          s.status === 'cancelled' ? 'Annulée' : 'Active'
        ];
      });

      // Échapper les champs CSV
      const escapeCSV = (val) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const csvContent = BOM + [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = `ventes-${new Date().toISOString().split('T')[0]}.csv`;

      // Déclencher le téléchargement
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      return { success: true, filename };
    },
    /**
     * Rapport fin de journée (pdf|xlsx) optionnellement daté.
     */
    async dailyReport(format = 'pdf', date = null) {
      const qs = new URLSearchParams();
      qs.set('format', format);
      if (date) qs.set('date', date);
      return downloadExport(`/exports/daily-report?${qs.toString()}`);
    }
  }
};
