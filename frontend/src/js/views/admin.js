import { API } from '../api.js';
import { escapeHtml, escapeAttr } from '../utils.js';
import { Toast, withLoading, Skeletons, confirmModal, alertModal } from '../utils/ui.js';
import { setupDialog } from '../utils/aria.js';

export class AdminView {
  constructor() {
    this.tenants = [];
    this.pagination = {};
    this.currentPage = 1;
    this.searchQuery = '';
    this.dashboardData = null;
  }

  async render() {
    return `
      <div class="fade-in">
        <div style="display: flex; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 700; margin: 0;">Tableau de bord SuperAdmin</h2>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="font-weight: 700; color: var(--accent-color); font-size: 13px;">RDGESTION</span>
            <button id="btn-refresh-dashboard" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" title="Rafraîchir les métriques">Rafraîchir</button>
          </div>
        </div>

        <!-- KPIs -->
        <div id="dashboard-kpis" class="dashboard-kpis-grid">
          ${Array(8).fill('<div class="skeleton skeleton-row" style="height: 90px; border-radius: var(--radius);"></div>').join('')}
        </div>

        <!-- Graphiques -->
        <div class="dashboard-charts-row">
          <div class="card" style="flex: 1;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 16px;">Inscriptions (30 derniers jours)</h3>
            <div id="dashboard-chart-inscriptions" style="height: 200px;"><div class="skeleton skeleton-row" style="height: 200px;"></div></div>
          </div>
          <div class="card" style="flex: 1;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 16px;">Évolution des ventes (30 derniers jours)</h3>
            <div id="dashboard-chart-ventes" style="height: 200px;"><div class="skeleton skeleton-row" style="height: 200px;"></div></div>
          </div>
        </div>

        <!-- Drill-down -->
        <div class="dashboard-drilldown-row">
          <div class="card" style="flex: 1;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Top 5 boutiques</h3>
            <div id="dashboard-top-boutiques">${Array(5).fill('<div class="skeleton skeleton-row" style="height: 32px; margin-bottom: 6px;"></div>').join('')}</div>
          </div>
          <div class="card" style="flex: 1;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Répartition par ville</h3>
            <div id="dashboard-repartition">${Array(5).fill('<div class="skeleton skeleton-row" style="height: 32px; margin-bottom: 6px;"></div>').join('')}</div>
          </div>
          <div class="card" style="flex: 1;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Santé plateforme</h3>
            <div id="dashboard-sante">${Array(5).fill('<div class="skeleton skeleton-row" style="height: 32px; margin-bottom: 6px;"></div>').join('')}</div>
          </div>
          <div class="card" style="flex: 1;">
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Répartition par pays</h3>
            <div id="dashboard-pays">${Array(5).fill('<div class="skeleton skeleton-row" style="height: 32px; margin-bottom: 6px;"></div>').join('')}</div>
          </div>
        </div>

        <!-- Registre des boutiques -->
        <div style="margin-top: 32px;">
          <div style="display: flex; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px; font-weight: 600; margin: 0;">Registre des Boutiques</h3>
            <input type="text" id="admin-search-tenant" class="form-input" placeholder="Rechercher par nom, telephone, gerant..." style="max-width: 400px;">
          </div>

          <div class="card">
            <div class="table-responsive">
              <table class="table" style="font-size: 13px;">
                <thead>
                  <tr>
                    <th>Nom de la boutique</th>
                    <th>Gerant</th>
                    <th>Telephone</th>
                    <th>Collaborateurs</th>
                    <th>Offre actuelle</th>
                    <th>Etat</th>
                    <th>Date d'expiration</th>
                    <th style="text-align: center;">Acces plateforme</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody id="tenants-table-body">
                  <tr><td colspan="9" class="text-center">Chargement...</td></tr>
                </tbody>
              </table>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
              <span id="admin-pagination-text" style="font-size: 13px; color: var(--text-secondary);">Affichage 0 de 0</span>
              <div style="display: flex; gap: 8px;">
                <button id="btn-admin-prev" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Precedent</button>
                <button id="btn-admin-next" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Suivant</button>
              </div>
            </div>
          </div>
        </div>

        <div id="admin-modal-container"></div>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Panel SuperAdmin';

    document.getElementById('btn-refresh-dashboard').addEventListener('click', () => {
      this.loadDashboard();
      this.loadTenants();
    });

    document.getElementById('admin-search-tenant').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.currentPage = 1;
      this.loadTenants();
    });

    document.getElementById('btn-admin-prev').addEventListener('click', () => {
      if (this.currentPage > 1) { this.currentPage--; this.loadTenants(); }
    });

    document.getElementById('btn-admin-next').addEventListener('click', () => {
      if (this.currentPage < this.pagination.pages) { this.currentPage++; this.loadTenants(); }
    });

    await Promise.all([this.loadDashboard(), this.loadTenants()]);
  }

  // ─── Dashboard Analytics ────────────────────────────────────

  async loadDashboard() {
    try {
      const res = await API.admin.getDashboard();
      this.dashboardData = res.data;
      this.renderKPIs(res.data);
      this.renderBarChart('dashboard-chart-inscriptions', res.data.acquisition.evolution_inscriptions);
      this.renderLineChart('dashboard-chart-ventes', res.data.engagement.evolution_ventes);
      this.renderTopBoutiques(res.data.engagement.top_boutiques);
      this.renderRepartition(res.data.repartition.par_ville, 'dashboard-repartition');
      this.renderRepartition(res.data.repartition.par_pays, 'dashboard-pays');
      this.renderSante(res.data.sante_plateforme);
    } catch (e) {
      console.error('[Dashboard] Erreur:', e);
      const kpiContainer = document.getElementById('dashboard-kpis');
      if (kpiContainer) kpiContainer.innerHTML = '<p style="color: var(--error); grid-column: 1/-1; text-align: center;">Impossible de charger les metriques.</p>';
    }
  }

  renderKPIs(d) {
    const ac = d.acquisition || {};
    const ac2 = d.activation || {};
    const en = d.engagement || {};
    const mo = d.monetisation || {};
    const sa = d.sante_plateforme || {};

    const cards = [
      { label: 'Total inscriptions', value: ac.total_inscriptions ?? 0, sub: `+${ac.inscrits_aujourd_hui ?? 0} aujourd'hui` },
      { label: 'Boutiques actives (7j)', value: en.boutiques_actives_7j ?? 0, sub: `${en.boutiques_actives_30j ?? 0} sur 30j` },
      { label: 'Ventes aujourd\'hui', value: en.ventes_aujourd_hui ?? 0, sub: `${en.ventes_7j ?? 0} sur 7j` },
      { label: 'MRR (FCFA)', value: (mo.mrr ?? 0).toLocaleString('fr-FR'), sub: `${mo.pro_count ?? 0} boutiques PRO` },
      { label: 'Onboarding complete', value: `${ac2.onboarding_completion_rate ?? 0}%`, sub: `${ac2.onboarding_en_cours ?? 0} en cours` },
      { label: 'Conversion FREE -> PRO', value: `${mo.conversion_free_to_pro ?? 0}%`, sub: `${mo.free_count ?? 0} FREE` },
      { label: 'Boutiques inactives', value: sa.boutiques_inactives ?? 0, sub: sa.boutiques_inactives > 0 ? 'a surveiller' : 'OK', danger: sa.boutiques_inactives > 0 },
      { label: 'Alertes stock rupture', value: sa.alertes_stock_rupture ?? 0, sub: sa.alertes_stock_rupture > 0 ? 'a traiter' : 'OK', danger: sa.alertes_stock_rupture > 0 },
    ];

    document.getElementById('dashboard-kpis').innerHTML = cards.map(c => `
      <div class="card" style="padding: 16px; ${c.danger ? 'border-left: 3px solid var(--error);' : ''}">
        <div style="font-size: 24px; font-weight: 800; color: ${c.danger ? 'var(--error)' : 'var(--accent-color)'};">${escapeHtml(String(c.value))}</div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(c.label)}</div>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">${escapeHtml(c.sub)}</div>
      </div>
    `).join('');
  }

  renderBarChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el || !data || data.length === 0) { el.innerHTML = '<p style="color: var(--text-secondary); text-align: center; line-height: 200px;">Aucune donnée</p>'; return; }
    const max = Math.max(...data.map(d => d.count), 1);
    el.innerHTML = `<div style="display: flex; align-items: flex-end; gap: 2px; height: 100%; padding-bottom: 20px; position: relative;">
      ${data.map(d => {
        const h = (d.count / max) * 100;
        return `<div title="${escapeHtml(d.date)}: ${d.count} inscription(s)" style="flex: 1; height: ${Math.max(h, 2)}%; background: var(--accent-color); border-radius: 2px 2px 0 0; min-height: 2px; opacity: ${d.count > 0 ? 1 : 0.2}; cursor: pointer;"></div>`;
      }).join('')}
      <div style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; font-size: 10px; color: var(--text-tertiary); padding: 0 4px;">
        <span>${escapeHtml(data[0].date)}</span><span>${escapeHtml(data[data.length-1].date)}</span>
      </div>
    </div>`;
  }

  renderLineChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el || !data || data.length === 0) { el.innerHTML = '<p style="color: var(--text-secondary); text-align: center; line-height: 200px;">Aucune donnée</p>'; return; }
    const max = Math.max(...data.map(d => d.count), 1);
    const w = 600, h = 180, pad = 10;
    const stepX = (w - pad * 2) / (data.length - 1 || 1);
    const points = data.map((d, i) => `${pad + i * stepX},${h - pad - (d.count / max) * (h - pad * 2)}`);
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width: 100%; height: 100%;">
      <polyline points="${points.join(' ')}" fill="none" stroke="var(--accent-color)" stroke-width="2"/>
      ${data.map((d, i) => `<circle cx="${pad + i * stepX}" cy="${h - pad - (d.count / max) * (h - pad * 2)}" r="2" fill="var(--accent-color)"><title>${escapeHtml(d.date)}: ${d.count} vente(s), ${d.revenue} FCFA</title></circle>`).join('')}
    </svg>`;
  }

  renderTopBoutiques(boutiques) {
    const el = document.getElementById('dashboard-top-boutiques');
    if (!el) return;
    if (!boutiques || boutiques.length === 0) { el.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">Aucune vente.</p>'; return; }
    el.innerHTML = boutiques.map((b, i) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
        <span style="font-size: 13px; font-weight: 600;">${i+1}. ${escapeHtml(b.name || 'N/A')}</span>
        <span style="font-size: 12px; color: var(--text-secondary);">${b.ventes_count ?? 0} ventes - ${(b.revenue ?? 0).toLocaleString('fr-FR')} F</span>
      </div>
    `).join('');
  }

  renderRepartition(items, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!items || items.length === 0) { el.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">Aucune donnée.</p>'; return; }
    const max = Math.max(...items.map(i => i.count), 1);
    el.innerHTML = items.slice(0, 8).map(item => {
      const pct = (item.count / max) * 100;
      return `<div style="margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
          <span>${escapeHtml(item.city || item.country || 'N/A')}</span>
          <span style="color: var(--text-secondary);">${item.count}</span>
        </div>
        <div style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: var(--accent-color); border-radius: 2px;"></div>
        </div>
      </div>`;
    }).join('');
  }

  renderSante(sa) {
    const el = document.getElementById('dashboard-sante');
    if (!el) return;
    const items = [
      { label: 'Boutiques inactives', value: sa.boutiques_inactives ?? 0, danger: (sa.boutiques_inactives ?? 0) > 0 },
      { label: 'Abonnements expirant (7j)', value: sa.abonnements_expirant_7j ?? 0, danger: (sa.abonnements_expirant_7j ?? 0) > 0 },
      { label: 'Alertes stock rupture', value: sa.alertes_stock_rupture ?? 0, danger: (sa.alertes_stock_rupture ?? 0) > 0 },
      { label: 'Notifications non lues', value: sa.notifications_non_lues_total ?? 0 },
      { label: 'Erreurs recents (24h)', value: sa.erreurs_recentes ?? 0, danger: (sa.erreurs_recentes ?? 0) > 5 },
    ];
    el.innerHTML = items.map(it => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
        <span style="font-size: 13px;">${escapeHtml(it.label)}</span>
        <span style="font-size: 13px; font-weight: 700; color: ${it.danger ? 'var(--error)' : 'var(--text-primary)'};">${it.value}</span>
      </div>
    `).join('');
  }

  // ─── Registre des boutiques (logique existante preservee) ────

  async loadTenants() {
    const tbody = document.getElementById('tenants-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">Chargement des boutiques...</td></tr>';

    try {
      const res = await API.admin.listTenants({
        page: this.currentPage,
        limit: 15,
        search: this.searchQuery || undefined
      });

      this.tenants = res.data.tenants;
      this.pagination = res.data.pagination;

      document.getElementById('admin-pagination-text').textContent =
        `Affichage de ${this.tenants.length} sur ${this.pagination.total} boutique(s) enregistree(s)`;
      document.getElementById('btn-admin-prev').disabled = this.currentPage === 1;
      document.getElementById('btn-admin-next').disabled = this.currentPage >= this.pagination.pages;

      if (this.tenants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--text-secondary);">Aucune boutique trouvee.</td></tr>';
        return;
      }

      tbody.innerHTML = this.tenants.map(t => {
        if (t.id === '00000000-0000-0000-0000-000000000000') return '';
        const tenantName = escapeHtml(t.name);
        const ownerName = escapeHtml(t.owner_name);
        const phone = escapeHtml(t.phone);

        const tierBadge = t.subscription_tier === 'PRO'
          ? '<span class="badge badge-success">PRO</span>'
          : '<span class="badge" style="background: var(--bg-tertiary);">FREE</span>';

        let subStatus = '<span class="badge badge-danger">Expire</span>';
        if (t.subscription_status === 'ACTIVE') {
          subStatus = '<span class="badge badge-success">Actif</span>';
        }

        const expiry = t.subscription_end_date
          ? new Date(t.subscription_end_date).toLocaleDateString('fr-FR')
          : 'Illimite';

        const accessBadge = t.is_active
          ? '<span class="badge badge-success">Autorise</span>'
          : '<span class="badge badge-danger">Suspendu</span>';

        const toggleAccessLabel = t.is_active ? 'Suspendre' : 'Debloquer';

        return `
          <tr style="${!t.is_active ? 'opacity: 0.6;' : ''}">
            <td data-label="Nom de la boutique"><strong>${tenantName}</strong></td>
            <td data-label="Gerant">${ownerName}</td>
            <td data-label="Telephone"><code>${phone}</code></td>
            <td data-label="Collaborateurs" style="text-align: center;"><span class="badge" style="background: var(--bg-tertiary);">${t.user_count}</span></td>
            <td data-label="Offre actuelle">${tierBadge}</td>
            <td data-label="Etat">${subStatus}</td>
            <td data-label="Date d'expiration"><small>${expiry}</small></td>
            <td data-label="Acces plateforme" style="text-align: center;">${accessBadge}</td>
            <td data-label="Actions" style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
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

      tbody.querySelectorAll('.btn-activate-pro').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openActivateProModal(btn.dataset.id, btn.dataset.name);
        });
      });

      tbody.querySelectorAll('.btn-toggle-tenant').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const currentActive = btn.dataset.active === 'true';
          const nextActive = !currentActive;

          const confirmed = await confirmModal(`Voulez-vous vraiment ${nextActive ? 'autoriser' : 'suspendre'} l'acces de cette boutique a la plateforme ?`, { title: nextActive ? 'Autoriser la boutique' : 'Suspendre la boutique', confirmText: nextActive ? 'Autoriser' : 'Suspendre', danger: !nextActive });
          if (confirmed) {
            try {
              await API.admin.toggleTenant(id, nextActive);
              await this.loadTenants();
            } catch (err) {
              alertModal(err.message, { title: 'Erreur' });
            }
          }
        });
      });

    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--error);">Erreur lors du chargement des tenants.</td></tr>';
    }
  }

  openActivateProModal(tenantId, tenantName) {
    const container = document.getElementById('admin-modal-container');
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="activate-pro-modal-title" style="font-size: 16px; font-weight: 600;">Activer plan PRO : ${escapeHtml(tenantName)}</h3>
            <button id="modal-close" style="font-size: 20px;" aria-label="Fermer la fenetre">x</button>
          </div>

          <form id="activate-pro-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Type de facturation / Duree</label>
                <select id="sub-billing-type" class="form-input" required>
                  <option value="MONTHLY">PRO Mensuel (30 jours de validite)</option>
                  <option value="LIFETIME">PRO Lifetime (Abonnement a vie / illimite)</option>
                </select>
              </div>
              <p style="font-size: 12px; color: var(--text-secondary);">Cette activation manuelle creditera instantanement le compte PRO de la boutique et loggera l'action dans le registre d'audit.</p>
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
        alertModal(`PRO ${billingType} active pour ${escapeHtml(tenantName)}`, { title: 'Activation PRO' });
        await this.loadTenants();
      } catch (err) {
        alertModal(err.message, { title: 'Erreur' });
      }
    });
  }
}
