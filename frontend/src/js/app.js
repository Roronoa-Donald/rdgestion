import { Router } from './router.js';
import { LoginView, RegisterView, OnboardingView } from './views/auth.js';
import { DashboardView } from './views/dashboard.js';
import { ProductsView } from './views/products.js';
import { StockView } from './views/stock.js';
import { POSView } from './views/pos.js';
import { SalesView } from './views/sales.js';
import { LogsView } from './views/logs.js';
import { SettingsView } from './views/settings.js';
import { AdminView } from './views/admin.js';
import { API } from './api.js';
import { escapeHtml } from './utils.js';
import { Toast, LoadingIndicator, confirmModal, alertModal } from './utils/ui.js';

// Table de routage de la Single Page Application (SPA)
const routes = {
  '#/login': { view: LoginView, guestOnly: true },
  '#/register': { view: RegisterView, guestOnly: true },
  '#/onboarding': { view: OnboardingView, requiresAuth: true, roles: ['ADMIN'] },
  '#/dashboard': { view: DashboardView, requiresAuth: true, roles: ['ADMIN'], layout: 'auth' },
  '#/products': { view: ProductsView, requiresAuth: true, roles: ['ADMIN'], layout: 'auth' },
  '#/stock': { view: StockView, requiresAuth: true, roles: ['ADMIN'], layout: 'auth' },
  '#/pos': { view: POSView, requiresAuth: true, roles: ['ADMIN', 'SELLER'], layout: 'auth' },
  '#/sales': { view: SalesView, requiresAuth: true, roles: ['ADMIN', 'SELLER'], layout: 'auth' },
  '#/logs': { view: LogsView, requiresAuth: true, roles: ['ADMIN'], layout: 'auth' },
  '#/settings': { view: SettingsView, requiresAuth: true, roles: ['ADMIN'], layout: 'auth' },
  '#/admin': { view: AdminView, requiresAuth: true, roles: ['SUPERADMIN'], layout: 'auth' }
};

// Initialiser le routeur
const router = new Router(routes, 'content-area');

/**
 * Configure la visibilité du menu de la barre latérale selon le rôle utilisateur.
 */
function updateMenuVisibility() {
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  
  const navDashboard = document.getElementById('nav-dashboard');
  const navPos = document.getElementById('nav-pos');
  const navProducts = document.getElementById('nav-products');
  const navStock = document.getElementById('nav-stock');
  const navSales = document.getElementById('nav-sales');
  const navLogs = document.getElementById('nav-logs');
  const navSettings = document.getElementById('nav-settings');
  const navAdmin = document.getElementById('nav-admin');

  if (!user) return;

  // Masquer la vue d'en-tête (Header) si non connecté
  const header = document.getElementById('main-header');
  if (header) {
    header.style.display = 'flex';
  }

  if (user.role === 'SUPERADMIN') {
    if (navDashboard) navDashboard.style.display = 'none';
    if (navPos) navPos.style.display = 'none';
    if (navProducts) navProducts.style.display = 'none';
    if (navStock) navStock.style.display = 'none';
    if (navSales) navSales.style.display = 'none';
    if (navLogs) navLogs.style.display = 'none';
    if (navSettings) navSettings.style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'block';
  } else if (user.role === 'SELLER') {
    if (navDashboard) navDashboard.style.display = 'none';
    if (navPos) navPos.style.display = 'block';
    if (navProducts) navProducts.style.display = 'none';
    if (navStock) navStock.style.display = 'none';
    if (navSales) navSales.style.display = 'block';
    if (navLogs) navLogs.style.display = 'none';
    if (navSettings) navSettings.style.display = 'none';
    if (navAdmin) navAdmin.style.display = 'none';
  } else {
    // ADMIN (Gérant)
    if (navDashboard) navDashboard.style.display = 'block';
    if (navPos) navPos.style.display = 'block';
    if (navProducts) navProducts.style.display = 'block';
    if (navStock) navStock.style.display = 'block';
    if (navSales) navSales.style.display = 'block';
    if (navLogs) navLogs.style.display = 'block';
    if (navSettings) navSettings.style.display = 'block';
    if (navAdmin) navAdmin.style.display = 'none';
  }
}

/**
 * Charge et rafraîchit le badge des notifications non lues.
 */
async function refreshNotifications() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // Le SuperAdmin n'a pas de boutique ni de notifications tenant
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  if (user?.role === 'SUPERADMIN') return;

  try {
    const res = await API.notifications.list(false); // Unread
    const badge = document.getElementById('unread-count');
    if (badge) {
      const unreadCount = res?.data?.unread_count ?? 0;
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Erreur rafraîchissement notifications :', e);
  }
}

/**
 * Affiche la boîte de dialogue (modal) contenant les notifications.
 */
async function openNotificationsModal() {
  const modalContainer = document.createElement('div');
  modalContainer.id = 'notif-modal-wrapper';
  document.body.appendChild(modalContainer);

  let listHtml = '<li>Chargement...</li>';
  modalContainer.innerHTML = `
    <div class="modal-overlay" style="z-index: 1100;">
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3 style="font-size: 15px; font-weight: 600;">Centre de Notifications</h3>
          <button id="notif-modal-close" style="font-size: 20px;">×</button>
        </div>
        <div class="modal-body" style="max-height: 380px; overflow-y: auto;">
          <ul id="notif-list-modal" style="list-style: none; display: flex; flex-direction: column; gap: 12px; padding: 0;">
            <!-- Injecté -->
          </ul>
        </div>
        <div class="modal-footer" style="justify-content: space-between;">
          <button id="btn-notif-read-all" class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;">Tout marquer comme lu</button>
          <button id="notif-modal-close-btn" class="btn btn-primary" style="font-size: 12px; padding: 6px 12px;">Fermer</button>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => modalContainer.remove();
  document.getElementById('notif-modal-close').addEventListener('click', closeFn);
  document.getElementById('notif-modal-close-btn').addEventListener('click', closeFn);

  // Charger les notifications dans la modale
  try {
    const res = await API.notifications.list(true); // Inclure lues
    const listEl = document.getElementById('notif-list-modal');
    
    const notifications = res?.data?.notifications ?? [];
    if (notifications.length === 0) {
      listEl.innerHTML = '<li style="text-align: center; color: var(--text-secondary); padding: 20px 0;">Aucune notification.</li>';
    } else {
      listEl.innerHTML = notifications.map(n => {
        const date = new Date(n.created_at).toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const unreadStyle = !n.is_read ? 'background: var(--accent-light);' : '';
        const title = escapeHtml(n.title);
        const message = escapeHtml(n.message);
        
        return `
          <li style="padding: 10px; border-bottom: 1px solid var(--border-color); ${unreadStyle} display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <strong style="font-size: 13px;">${title}</strong>
              <small style="color: var(--text-muted); font-size: 11px;">${date}</small>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary);">${message}</p>
          </li>
        `;
      }).join('');
    }

    // Tout marquer comme lu
    document.getElementById('btn-notif-read-all').addEventListener('click', async () => {
      try {
        await API.notifications.readAll();
        closeFn();
        await refreshNotifications();
      } catch (err) {
        alertModal(err.message);
      }
    });

  } catch (err) {
    console.error(err);
  }
}

// Initialisation globale au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  // Initialiser les composants UX
  Toast.init();
  LoadingIndicator.init();

  // Configurer le bouton de changement de thème
  const themeBtn = document.getElementById('theme-btn');
  themeBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  });

  // Configurer le bouton de déconnexion
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', async () => {
    const confirmed = await confirmModal('Voulez-vous vraiment vous déconnecter ?', { title: 'Déconnexion', confirmText: 'Se déconnecter', danger: true });
    if (confirmed) {
      localStorage.clear();
      window.location.hash = '#/login';
      const sidebar = document.getElementById('sidebar-navigation');
      const header = document.getElementById('main-header');
      if (sidebar) sidebar.style.display = 'none';
      if (header) header.style.display = 'none';
    }
  });

  // Gérer l'expiration de session globale
  window.addEventListener('auth-expired', () => {
    alertModal('Votre session a expiré. Veuillez vous reconnecter.', { title: 'Session expirée' });
    window.location.hash = '#/login';
    const sidebar = document.getElementById('sidebar-navigation');
    const header = document.getElementById('main-header');
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';
  });

  // Configurer la cloche de notifications
  document.getElementById('bell-btn').addEventListener('click', openNotificationsModal);

  // Mettre à jour le menu sur chaque routage
  window.addEventListener('hashchange', updateMenuVisibility);

  // Initialisation du routeur
  router.init();
  
  // Exécuter la visibilité du menu
  updateMenuVisibility();

  // Lancer le polling de notifications (toutes les 30 secondes)
  refreshNotifications();
  setInterval(refreshNotifications, 30000);

  // Gestion du statut de connexion (Offline/Online)
  function updateOnlineStatus() {
    const offlineBanner = document.getElementById('offline-banner');
    if (navigator.onLine) {
      if (offlineBanner) offlineBanner.style.display = 'none';
    } else {
      if (offlineBanner) {
        offlineBanner.style.display = 'block';
      } else {
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; background-color: var(--warning); color: var(--text-primary); text-align: center; padding: 8px; font-size: 13px; font-weight: bold; z-index: 9999; box-shadow: var(--shadow-md);';
        banner.innerHTML = 'Mode hors ligne actif. La consultation reste disponible, mais l\'enregistrement des ventes et des produits est bloqué.';
        document.body.appendChild(banner);
      }
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus(); // Exécuter la vérification initiale

  // Enregistrer le Service Worker (PWA Support)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .catch((err) => console.error('Echec d\'enregistrement du Service Worker :', err));
    });
  }
});
