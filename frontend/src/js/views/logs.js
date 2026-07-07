import { API } from '../api.js';
import { escapeAttr, escapeHtml } from '../utils.js';
import { Toast, withLoading, Skeletons } from '../utils/ui.js';
import { setupDialog } from '../utils/aria.js';

export class LogsView {
  constructor() {
    this.logs = [];
    this.pagination = {};
    this.currentPage = 1;
    this.filters = {
      action: '',
      user_id: '',
      from: '',
      to: ''
    };
  }

  async render() {
    return `
      <div class="fade-in">
        <!-- Filtres logs -->
        <div class="card" style="padding: 16px; margin-bottom: 24px;">
          <form id="logs-filter-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: flex-end;">
            <div>
              <label class="form-label" style="font-size: 11px;">Du (Date de début)</label>
              <input type="date" id="log-filter-from" class="form-input" style="padding: 6px 10px; font-size: 13px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 11px;">Au (Date de fin)</label>
              <input type="date" id="log-filter-to" class="form-input" style="padding: 6px 10px; font-size: 13px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 11px;">Type d'action</label>
              <select id="log-filter-action" class="form-input" style="padding: 6px 10px; font-size: 13px;">
                <option value="">Toutes les actions</option>
                <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                <option value="PRODUCT_ADD">PRODUCT_ADD</option>
                <option value="PRODUCT_UPDATE">PRODUCT_UPDATE</option>
                <option value="PRODUCT_DELETE">PRODUCT_DELETE</option>
                <option value="SALE_CREATE">SALE_CREATE</option>
                <option value="SALE_CANCEL">SALE_CANCEL</option>
                <option value="SETTINGS_UPDATE">SETTINGS_UPDATE</option>
              </select>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="submit" class="btn btn-primary" style="flex: 1; padding: 8px; font-size: 13px;">Filtrer</button>
              <button type="button" id="btn-log-reset" class="btn btn-secondary" style="padding: 8px; font-size: 13px;">Reset</button>
            </div>
          </form>
        </div>

        <!-- Tableau des logs -->
        <div class="card">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Journal d'Activité Boutique (Audit Trail)</h3>
          
          <div class="table-responsive">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Action</th>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Adresse IP</th>
                  <th>Navigateur / OS</th>
                  <th style="text-align: right;">Détails</th>
                </tr>
              </thead>
              <tbody id="logs-table-body">
                <!-- Rempli par JavaScript -->
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
            <span id="logs-pagination-text" style="font-size: 13px; color: var(--text-secondary);">Affichage 0 de 0</span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-logs-prev" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Précédent</button>
              <button id="btn-logs-next" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Suivant</button>
            </div>
          </div>
        </div>

        <!-- Modale JSON Viewer -->
        <div id="logs-modal-container"></div>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Journal d\'Activité';
    
    const form = document.getElementById('logs-filter-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.filters.from = document.getElementById('log-filter-from').value;
      this.filters.to = document.getElementById('log-filter-to').value;
      this.filters.action = document.getElementById('log-filter-action').value;
      this.currentPage = 1;
      this.loadLogs();
    });

    document.getElementById('btn-log-reset').addEventListener('click', () => {
      form.reset();
      this.filters = { action: '', user_id: '', from: '', to: '' };
      this.currentPage = 1;
      this.loadLogs();
    });

    document.getElementById('btn-logs-prev').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadLogs();
      }
    });

    document.getElementById('btn-logs-next').addEventListener('click', () => {
      if (this.currentPage < this.pagination.pages) {
        this.currentPage++;
        this.loadLogs();
      }
    });

    await this.loadLogs();
  }

  async loadLogs() {
    const tableBody = document.getElementById('logs-table-body');
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Chargement...</td></tr>';

    try {
      const res = await API.logs.list({
        page: this.currentPage,
        limit: 20,
        from: this.filters.from || undefined,
        to: this.filters.to || undefined,
        action: this.filters.action || undefined
      });

      this.logs = res.logs;
      this.pagination = res.pagination;

      document.getElementById('logs-pagination-text').textContent = 
        `Affichage de ${this.logs.length} sur ${this.pagination.total} entrée(s) de logs`;
      document.getElementById('btn-logs-prev').disabled = this.currentPage === 1;
      document.getElementById('btn-logs-next').disabled = this.currentPage >= this.pagination.pages;

      if (this.logs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color: var(--text-secondary);">Aucune activité enregistrée.</td></tr>';
        return;
      }

      tableBody.innerHTML = this.logs.map((log, index) => {
        const datetime = new Date(log.created_at).toLocaleString('fr-FR');
        
        const action = escapeHtml(log.action);
        let actionBadge = `<span class="badge" style="background: var(--bg-tertiary);">${action}</span>`;
        if (log.action.includes('SUCCESS') || log.action.includes('ADD') || log.action.includes('RESTORE')) {
          actionBadge = `<span class="badge badge-success">${action}</span>`;
        } else if (log.action.includes('FAILED') || log.action.includes('DELETE') || log.action.includes('DISABLE')) {
          actionBadge = `<span class="badge badge-danger">${action}</span>`;
        }

        const roleLabel = log.user_role === 'SELLER' ? 'Vendeur' : (log.user_role === 'SUPERADMIN' ? 'SuperAdmin' : 'Gérant');

        // Tronquer le User Agent pour affichage compact
        const uaRaw = log.user_agent || '';
        let uaText = 'Inconnu';
        if (uaRaw.includes('Chrome')) uaText = 'Chrome (PC/Android)';
        else if (uaRaw.includes('Safari')) uaText = 'Safari (iOS/Mac)';
        else if (uaRaw.includes('Firefox')) uaText = 'Firefox';
        else if (uaRaw.length > 0) uaText = uaRaw.substring(0, 15) + '...';

        return `
          <tr>
            <td>${datetime}</td>
            <td>${actionBadge}</td>
            <td><strong>${escapeHtml(log.username || 'Système')}</strong></td>
            <td><small>${roleLabel}</small></td>
            <td><code>${escapeHtml(log.ip_address || '-')}</code></td>
            <td title="${escapeAttr(uaRaw)}">${escapeHtml(uaText)}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-log-detail" data-index="${index}" style="padding: 2px 6px; font-size: 11px;">Inspecter</button>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.querySelectorAll('.btn-log-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.index, 10);
          this.openJSONModal(this.logs[idx]);
        });
      });

    } catch (e) {
      console.error(e);
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="color: var(--error);">Une erreur est survenue lors du chargement des logs.</td></tr>';
    }
  }

  /**
   * Ouvre la modale d'inspection des détails JSON du log.
   */
  openJSONModal(log) {
    const container = document.getElementById('logs-modal-container');
    
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h3 id="log-modal-title" style="font-size: 15px; font-weight: 600;">Inspecter Log Action : ${escapeHtml(log.action)}</h3>
            <button id="modal-close" style="font-size: 20px;" aria-label="Fermer la fenêtre">×</button>
          </div>
          
          <div class="modal-body">
            <pre style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 16px; overflow-x: auto; font-family: monospace; font-size: 12px; color: var(--success); max-height: 400px; overflow-y: auto;">${escapeHtml(JSON.stringify(log.details, null, 2))}</pre>
            
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div><strong>ID Log :</strong> ${escapeHtml(log.id)}</div>
              <div><strong>ID Entité :</strong> ${escapeHtml(log.entity_id || 'Aucun')}</div>
              <div><strong>Type Entité :</strong> ${escapeHtml(log.entity_type || 'Aucun')}</div>
              <div><strong>Adresse IP :</strong> ${escapeHtml(log.ip_address || '-')}</div>
              <div style="grid-column: span 2;"><strong>Agent utilisateur complet :</strong> <br><span style="word-break: break-all;">${escapeHtml(log.user_agent || '-')}</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-close').addEventListener('click', () => container.innerHTML = '');
    setupDialog(container.querySelector('.modal-content'), { labelledbyId: 'log-modal-title', closeFn: () => container.innerHTML = '' });
  }
}
