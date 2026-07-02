import { API } from '../api.js';
import { escapeAttr, escapeHtml } from '../utils.js';

export class SalesView {
  constructor() {
    this.sales = [];
    this.pagination = {};
    this.currentPage = 1;
    this.filters = {
      from: '',
      to: '',
      status: '',
      payment_method: ''
    };
  }

  async render() {
    return `
      <div class="fade-in">
        <!-- Section Filtres -->
        <div class="card" style="padding: 16px; margin-bottom: 24px;">
          <form id="sales-filter-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: flex-end;">
            <div>
              <label class="form-label" style="font-size: 11px;">Du (Date de début)</label>
              <input type="date" id="filter-from" class="form-input" style="padding: 6px 10px; font-size: 13px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 11px;">Au (Date de fin)</label>
              <input type="date" id="filter-to" class="form-input" style="padding: 6px 10px; font-size: 13px;">
            </div>
            <div>
              <label class="form-label" style="font-size: 11px;">Statut</label>
              <select id="filter-status" class="form-input" style="padding: 6px 10px; font-size: 13px;">
                <option value="">Tous statuts</option>
                <option value="active">Validées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size: 11px;">Mode Paiement</label>
              <select id="filter-method" class="form-input" style="padding: 6px 10px; font-size: 13px;">
                <option value="">Tous modes</option>
                <option value="CASH">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="submit" class="btn btn-primary" style="flex: 1; padding: 8px; font-size: 13px;">Filtrer</button>
              <button type="button" id="btn-reset-filters" class="btn btn-secondary" style="padding: 8px; font-size: 13px;">Reset</button>
            </div>
          </form>
        </div>

        <!-- Tableau des ventes -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px; font-weight: 600;">Historique des Ventes</h3>
            <button id="btn-export-sales" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Exporter rapport (PRO)</button>
          </div>
          
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Facture N°</th>
                  <th>Date & Heure</th>
                  <th>Vendeur</th>
                  <th>Mode Paiement</th>
                  <th>Sous-total</th>
                  <th>Remise</th>
                  <th>Net à Payer</th>
                  <th style="text-align: center;">Statut</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="sales-table-body">
                <!-- Rempli par JavaScript -->
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
            <span id="sales-pagination-text" style="font-size: 13px; color: var(--text-secondary);">Affichage 0 de 0</span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-sales-prev" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Précédent</button>
              <button id="btn-sales-next" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Suivant</button>
            </div>
          </div>
        </div>

        <!-- Modale Détails Vente -->
        <div id="sales-modal-container"></div>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Historique des Ventes';
    
    // Attacher filtres
    const form = document.getElementById('sales-filter-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.filters.from = document.getElementById('filter-from').value;
      this.filters.to = document.getElementById('filter-to').value;
      this.filters.status = document.getElementById('filter-status').value;
      this.filters.payment_method = document.getElementById('filter-method').value;
      this.currentPage = 1;
      this.loadSales();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      form.reset();
      this.filters = { from: '', to: '', status: '', payment_method: '' };
      this.currentPage = 1;
      this.loadSales();
    });

    document.getElementById('btn-export-sales').addEventListener('click', () => {
      // Explication PRO
      alert('Cette fonctionnalité d\'export Excel/PDF nécessite l\'abonnement premium PRO. Veuillez souscrire depuis le menu paramètres.');
    });

    document.getElementById('btn-sales-prev').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadSales();
      }
    });

    document.getElementById('btn-sales-next').addEventListener('click', () => {
      if (this.currentPage < this.pagination.pages) {
        this.currentPage++;
        this.loadSales();
      }
    });

    await this.loadSales();
  }

  /**
   * Récupère et affiche les ventes avec pagination.
   */
  async loadSales() {
    const tableBody = document.getElementById('sales-table-body');
    tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Chargement...</td></tr>';

    try {
      const res = await API.sales.list({
        page: this.currentPage,
        limit: 15,
        from: this.filters.from || undefined,
        to: this.filters.to || undefined,
        status: this.filters.status || undefined,
        payment_method: this.filters.payment_method || undefined
      });

      this.sales = res.sales;
      this.pagination = res.pagination;

      // Mettre à jour boutons pagination
      document.getElementById('sales-pagination-text').textContent = 
        `Affichage de ${this.sales.length} sur ${this.pagination.total} vente(s)`;
      document.getElementById('btn-sales-prev').disabled = this.currentPage === 1;
      document.getElementById('btn-sales-next').disabled = this.currentPage >= this.pagination.pages;

      if (this.sales.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--text-secondary);">Aucune vente enregistrée.</td></tr>';
        return;
      }

      tableBody.innerHTML = this.sales.map(s => {
        const datetime = new Date(s.created_at).toLocaleString('fr-FR', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        const transactionNumber = escapeHtml(s.transaction_number);
        const sellerName = escapeHtml(s.seller_name || '');
        
        const methodLabel = s.payment_method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Especes';
        const discountText = Number(s.discount_amount) > 0 ? `-${Number(s.discount_amount).toLocaleString()}` : '0';
        
        const statusBadge = s.is_cancelled 
          ? '<span class="badge badge-danger">Annulée</span>' 
          : '<span class="badge badge-success">Validée</span>';

        return `
          <tr style="${s.is_cancelled ? 'opacity: 0.6;' : ''}">
            <td><strong>${transactionNumber}</strong></td>
            <td>${datetime}</td>
            <td><code>${sellerName}</code></td>
            <td>${methodLabel}</td>
            <td>${Number(s.subtotal).toLocaleString()}</td>
            <td style="color: var(--error);">${discountText}</td>
            <td style="font-weight: 700;">${Number(s.total_amount).toLocaleString()} FCFA</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-detail" data-id="${escapeAttr(s.id)}" style="padding: 4px 8px; font-size: 11px;">Voir</button>
            </td>
          </tr>
        `;
      }).join('');

      // Actions détails
      tableBody.querySelectorAll('.btn-detail').forEach(btn => {
        btn.addEventListener('click', (e) => this.openDetailModal(e.target.dataset.id));
      });

    } catch (e) {
      console.error(e);
      tableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--error);">Erreur de chargement.</td></tr>';
    }
  }

  /**
   * Ouvre la modale d'affichage détaillé de la facture / vente.
   */
  async openDetailModal(saleId) {
    let sale = null;
    try {
      sale = await API.sales.get(saleId);
    } catch (err) {
      alert(err.message);
      return;
    }

    const container = document.getElementById('sales-modal-container');
    const currency = 'FCFA';
    const transactionNumber = escapeHtml(sale.transaction_number);
    const sellerName = escapeHtml(sale.seller_name || '');
    const momoReference = escapeHtml(sale.momo_reference || '');

    // Rendre l'état d'annulation dans la modale
    const cancelSection = sale.is_cancelled
      ? `<div class="badge badge-danger" style="display: block; text-align: center; padding: 10px; font-size: 13px; margin-bottom: 16px;">
          Annulée le ${new Date(sale.cancelled_at).toLocaleString('fr-FR')} par un administrateur.
         </div>`
      : `<button id="btn-modal-cancel-sale" class="btn btn-danger" style="width: 100%; padding: 10px; font-size: 13px; margin-top: 12px;">
          Annuler cette vente (recrediter les stocks)
         </button>`;

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 550px;">
          <div class="modal-header">
            <h3 style="font-size: 15px; font-weight: 600;">Détail Facture : ${transactionNumber}</h3>
            <button id="modal-close" style="font-size: 20px;">×</button>
          </div>
          
          <div class="modal-body">
            ${cancelSection}

            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div><strong>Date :</strong> ${new Date(sale.created_at).toLocaleString('fr-FR')}</div>
              <div><strong>Vendeur :</strong> ${sellerName}</div>
              <div><strong>Mode :</strong> ${sale.payment_method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Espèces'}</div>
              ${sale.momo_reference ? `<div><strong>Réf MoMo :</strong> <code>${momoReference}</code></div>` : ''}
            </div>

            <!-- Liste des articles -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius); overflow: hidden; margin-bottom: 16px;">
              <table class="table" style="font-size: 13px;">
                <thead style="background-color: var(--bg-tertiary);">
                  <tr>
                    <th style="padding: 8px 12px;">Article</th>
                    <th style="text-align: center; padding: 8px 12px;">Qté</th>
                    <th style="text-align: right; padding: 8px 12px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${sale.items.map(item => `
                    <tr>
                      <td style="padding: 8px 12px;">${escapeHtml(item.product_name)}<br><small style="color: var(--text-secondary);">${Number(item.unit_sell_price).toLocaleString()} FCFA</small></td>
                      <td style="text-align: center; padding: 8px 12px;">${item.quantity}</td>
                      <td style="text-align: right; font-weight: 600; padding: 8px 12px;">${Number(item.total_price).toLocaleString()} FCFA</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Résumé financier -->
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; border-top: 1px dashed var(--border-color); padding-top: 12px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Sous-total :</span>
                <span>${Number(sale.subtotal).toLocaleString()} ${currency}</span>
              </div>
              ${Number(sale.discount_amount) > 0 ? `
                <div style="display: flex; justify-content: space-between; color: var(--error);">
                  <span>Remise :</span>
                  <span>-${Number(sale.discount_amount).toLocaleString()} ${currency}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: var(--text-primary); margin-top: 6px;">
                <span>Total Net :</span>
                <span>${Number(sale.total_amount).toLocaleString()} ${currency}</span>
              </div>
            </div>

            <button id="btn-modal-reprint-ticket" class="btn btn-primary" style="width: 100%; margin-top: 16px; padding: 10px; font-size: 13px; background-color: var(--accent-color);">
              Reimprimer le ticket de caisse
            </button>
          </div>
        </div>
      </div>
    `;

    const closeFn = () => container.innerHTML = '';
    document.getElementById('modal-close').addEventListener('click', closeFn);

    // Reprint ticket
    document.getElementById('btn-modal-reprint-ticket').addEventListener('click', () => {
      API.sales.openTicket(sale.id).catch((err) => alert(err.message));
    });

    // Annuler la vente
    const cancelBtn = document.getElementById('btn-modal-cancel-sale');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (confirm('Êtes-vous sûr de vouloir ANNULER cette vente ? Le stock de tous ses produits sera recrédité en base.')) {
          try {
            await API.sales.cancel(sale.id);
            closeFn();
            await this.loadSales();
          } catch (err) {
            alert(err.message);
          }
        }
      });
    }
  }
}
