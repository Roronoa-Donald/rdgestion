import { API } from '../api.js';
import { escapeHtml, escapeAttr } from '../utils.js';
import { Toast, withLoading, Skeletons } from '../utils/ui.js';
import { setupDialog } from '../utils/aria.js';

export class AdminView {
  constructor() {
    this.tenants = [];
    this.pagination = {};
    this.currentPage = 1;
    this.searchQuery = '';
  }

  async render() {
    return `
      <div class="fade-in">
        <div style="display: flex; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <input type="text" id="admin-search-tenant" class="form-input" placeholder="Rechercher par nom, telephone, gerant..." style="max-width: 500px;">
          <div style="font-weight: 700; color: var(--accent-color);">Espace Super-Administrateur RDGESTION</div>
        </div>

        <div class="card">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Registre des Boutiques / Tenants</h3>
          
          <div class="table-responsive">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>Nom de la boutique</th>
                  <th>Gérant</th>
                  <th>Téléphone</th>
                  <th>Collaborateurs</th>
                  <th>Offre actuelle</th>
                  <th>État Offre</th>
                  <th>Date d'expiration</th>
                  <th style="text-align: center;">Accès plateforme</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="tenants-table-body">
                <tr>
                  <td colspan="9" class="text-center">Chargement...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
            <span id="admin-pagination-text" style="font-size: 13px; color: var(--text-secondary);">Affichage 0 de 0</span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-admin-prev" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Précédent</button>
              <button id="btn-admin-next" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Suivant</button>
            </div>
          </div>
        </div>

        <!-- Boîte de dialogue / Modale activation PRO -->
        <div id="admin-modal-container"></div>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Panel SuperAdmin';
    
    // Attacher recherche
    document.getElementById('admin-search-tenant').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.currentPage = 1;
      this.loadTenants();
    });

    document.getElementById('btn-admin-prev').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadTenants();
      }
    });

    document.getElementById('btn-admin-next').addEventListener('click', () => {
      if (this.currentPage < this.pagination.pages) {
        this.currentPage++;
        this.loadTenants();
      }
    });

    await this.loadTenants();
  }

  async loadTenants() {
    const tbody = document.getElementById('tenants-table-body');
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Chargement des boutiques...</td></tr>';

    try {
      const res = await API.admin.listTenants({
        page: this.currentPage,
        limit: 15,
        search: this.searchQuery || undefined
      });

      this.tenants = res.tenants;
      this.pagination = res.pagination;

      document.getElementById('admin-pagination-text').textContent = 
        `Affichage de ${this.tenants.length} sur ${this.pagination.total} boutique(s) enregistrée(s)`;
      document.getElementById('btn-admin-prev').disabled = this.currentPage === 1;
      document.getElementById('btn-admin-next').disabled = this.currentPage >= this.pagination.pages;

      if (this.tenants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--text-secondary);">Aucune boutique trouvée.</td></tr>';
        return;
      }

      tbody.innerHTML = this.tenants.map(t => {
        // Exclure le tenant Plateforme
        if (t.id === '00000000-0000-0000-0000-000000000000') {
          return '';
        }
        const tenantName = escapeHtml(t.name);
        const ownerName = escapeHtml(t.owner_name);
        const phone = escapeHtml(t.phone);

        const tierBadge = t.subscription_tier === 'PRO' 
          ? '<span class="badge badge-success">PRO</span>' 
          : '<span class="badge" style="background: var(--bg-tertiary);">FREE</span>';
        
        let subStatus = '<span class="badge badge-danger">Expiré</span>';
        if (t.subscription_status === 'ACTIVE') {
          subStatus = '<span class="badge badge-success">Actif</span>';
        }

        const expiry = t.subscription_end_date 
          ? new Date(t.subscription_end_date).toLocaleDateString('fr-FR') 
          : 'Illimité';

        const accessBadge = t.is_active 
          ? '<span class="badge badge-success">Autorisé</span>' 
          : '<span class="badge badge-danger">Suspendu</span>';

        const toggleAccessLabel = t.is_active ? 'Suspendre' : 'Débloquer';

        return `
          <tr style="${!t.is_active ? 'opacity: 0.6;' : ''}">
            <td><strong>${tenantName}</strong></td>
            <td>${ownerName}</td>
            <td><code>${phone}</code></td>
            <td style="text-align: center;"><span class="badge" style="background: var(--bg-tertiary);">${t.user_count}</span></td>
            <td>${tierBadge}</td>
            <td>${subStatus}</td>
            <td><small>${expiry}</small></td>
            <td style="text-align: center;">${accessBadge}</td>
            <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-activate-pro" data-id="${escapeAttr(t.id)}" data-name="${escapeAttr(t.name)}" style="padding: 4px 8px; font-size: 11px;">
                Activer PRO
              </button>
              <button class="btn btn-secondary btn-toggle-tenant" data-id="${escapeAttr(t.id)}" data-active="${t.is_active}" style="padding: 4px 8px; font-size: 11px;">
                ${toggleAccessLabel}
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Attacher événements d'actions
      tbody.querySelectorAll('.btn-activate-pro').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.openActivateProModal(btn.dataset.id, btn.dataset.name);
        });
      });

      tbody.querySelectorAll('.btn-toggle-tenant').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const currentActive = btn.dataset.active === 'true';
          const nextActive = !currentActive;
          
          if (confirm(`Voulez-vous vraiment ${nextActive ? 'autoriser' : 'suspendre'} l'accès de cette boutique à la plateforme ?`)) {
            try {
              await API.admin.toggleTenant(id, nextActive);
              await this.loadTenants();
            } catch (err) {
              Toast.error(err.message);
            }
          }
        });
      });

    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--error);">Erreur lors du chargement des tenants.</td></tr>';
    }
  }

  /**
   * Ouvre la modale pour forcer l'activation PRO (MANUAL) par le SuperAdmin.
   */
  openActivateProModal(tenantId, tenantName) {
    const container = document.getElementById('admin-modal-container');
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="activate-pro-modal-title" style="font-size: 16px; font-weight: 600;">Activer plan PRO : ${escapeHtml(tenantName)}</h3>
            <button id="modal-close" style="font-size: 20px;" aria-label="Fermer la fenêtre">×</button>
          </div>
          
          <form id="activate-pro-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Type de facturation / Durée</label>
                <select id="sub-billing-type" class="form-input" required>
                  <option value="MONTHLY">PRO Mensuel (30 jours de validité)</option>
                  <option value="LIFETIME">PRO Lifetime (Abonnement à vie / illimité)</option>
                </select>
              </div>
              <p style="font-size: 12px; color: var(--text-secondary);">Cette activation manuelle créditera instantanément le compte PRO de la boutique et loggera l'action dans le registre d'audit.</p>
            </div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary modal-close-btn">Annuler</button>
              <button type="submit" class="btn btn-primary">Activer l'offre</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeFn = () => container.innerHTML = '';
    document.getElementById('modal-close').addEventListener('click', closeFn);
    container.querySelector('.modal-close-btn').addEventListener('click', closeFn);

    setupDialog(container.querySelector('.modal-content'), { labelledbyId: 'activate-pro-modal-title', closeFn });

    const form = document.getElementById('activate-pro-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const billingType = document.getElementById('sub-billing-type').value;

      try {
        await API.admin.activateSubscription(tenantId, billingType);
        closeFn();
        Toast.success(`PRO ${billingType} activé pour ${escapeHtml(tenantName)}`);
        await this.loadTenants();
      } catch (err) {
        Toast.error(err.message);
      }
    });
  }
}
