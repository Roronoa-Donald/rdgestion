const DEBUG = false;
function log(...args) { if (DEBUG) console.log(...args); }

export class Router {
  constructor(routes, containerId) {
    this.routes = routes;
    this.container = document.getElementById(containerId);
    this.currentView = null;
    
    // Écouter le changement de hash
    window.addEventListener('hashchange', () => this.handleRouting());
  }

  init() {
    this.handleRouting();
  }

  /**
   * Résout le chemin du hash actuel et charge la vue appropriée.
   */
  async handleRouting() {
    let hash = window.location.hash || '#/';
    
    // Nettoyer les paramètres éventuels du hash (ex: #/products?id=123)
    const queryIndex = hash.indexOf('?');
    let queryParams = {};
    if (queryIndex !== -1) {
      const queryString = hash.substring(queryIndex + 1);
      hash = hash.substring(0, queryIndex);
      const params = new URLSearchParams(queryString);
      for (const [key, value] of params.entries()) {
        queryParams[key] = value;
      }
    }

    // Récupérer les informations de session
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;

    // Définir la redirection par défaut pour la racine
    if (hash === '#/') {
      if (!token) {
        window.location.hash = '#/login';
        return;
      } else {
        window.location.hash = user?.role === 'SELLER' ? '#/pos' : '#/dashboard';
        return;
      }
    }

    // Trouver la route correspondante
    const route = this.routes[hash];

    if (!route) {
      // 404 -> Redirection intelligente
      window.location.hash = token ? (user?.role === 'SELLER' ? '#/pos' : '#/dashboard') : '#/login';
      return;
    }

    // Vérifier les protections d'authentification
    if (route.requiresAuth && !token) {
      window.location.hash = '#/login';
      return;
    }

    if (route.guestOnly && token) {
      window.location.hash = user?.role === 'SELLER' ? '#/pos' : '#/dashboard';
      return;
    }

    // Contrôle RBAC
    if (route.roles && (!user || !route.roles.includes(user.role))) {
      console.warn('Accès interdit pour le rôle :', user?.role);
      window.location.hash = user?.role === 'SELLER' ? '#/pos' : '#/dashboard';
      return;
    }

    // Masquer/Afficher la sidebar selon que la vue est publique ou authentifiée
    const sidebar = document.getElementById('sidebar-navigation');
    const layout = document.getElementById('app-layout');
    
    if (route.layout === 'auth' && sidebar && layout) {
      sidebar.style.display = 'flex';
      // Mettre à jour les informations du badge gérant/vendeur
      this.updateUserBadge(user);
      this.updateActiveMenuItem(hash);
    } else if (sidebar) {
      sidebar.style.display = 'none';
    }

    // Détruire l'ancienne vue pour libérer la mémoire (listeners, etc.)
    if (this.currentView && typeof this.currentView.destroy === 'function') {
      this.currentView.destroy();
    }

    // Instancier et charger la nouvelle vue
    try {
      log(`[Router] Loading view: ${hash}`);
      this.container.innerHTML = '<div class="text-center" style="padding: 100px 0;"><div class="skeleton-loader" style="width: 50px; height: 50px; border-radius: 50%; margin: 0 auto;"></div></div>';

      const viewInstance = new route.view(queryParams);
      this.currentView = viewInstance;

      const renderedHtml = await viewInstance.render();
      this.container.innerHTML = `<div class="fade-in">${renderedHtml}</div>`;

      if (typeof viewInstance.afterRender === 'function') {
        await viewInstance.afterRender();
      }
    } catch (error) {
      console.error(`[Router-Audit] ❌ FATAL ERROR loading view ${hash}:`, error);
      this.container.innerHTML = `
        <div class="card text-center" style="max-width: 500px; margin: 50px auto; padding: 40px;">
          <h2 style="color: var(--error); margin-bottom: 12px;">Erreur de chargement</h2>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">Impossible d'afficher cette section. Vérifiez votre connexion.</p>
          <button id="router-retry-btn" class="btn btn-primary">Réessayer</button>
        </div>
      `;
      document.getElementById('router-retry-btn')?.addEventListener('click', () => window.location.reload());
    }
  }

  /**
   * Met à jour le badge utilisateur dans la barre latérale.
   */
  updateUserBadge(user) {
    if (!user) return;
    const nameEl = document.getElementById('badge-user-name');
    const roleEl = document.getElementById('badge-user-role');
    const avatarEl = document.getElementById('badge-user-avatar');
    
    if (nameEl) nameEl.textContent = user.username;
    if (roleEl) roleEl.textContent = user.role === 'SELLER' ? 'Vendeur' : (user.role === 'SUPERADMIN' ? 'Super Admin' : 'Gérant');
    if (avatarEl) {
      avatarEl.textContent = user.username.substring(0, 2).toUpperCase();
    }
  }

  /**
   * Met en surbrillance l'item de menu actif de la sidebar.
   */
  updateActiveMenuItem(hash) {
    const items = document.querySelectorAll('.menu-item');
    items.forEach(item => {
      const link = item.querySelector('a');
      if (link && link.getAttribute('href') === hash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}
