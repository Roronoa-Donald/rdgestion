import { API } from '../api.js';
import { escapeAttr, escapeHtml } from '../utils.js';
import { Toast, withLoading, Skeletons } from '../utils/ui.js';
import { setupDialog } from '../utils/aria.js';

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

        <!-- Conteneur pour le panneau de détails (s'affiche entre filtres et tableau) -->
        <div id="sales-modal-container"></div>

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
            <span id="sales-pagination-text" style="font-size: 13px; color: var(--text-secondary);">Affichage de 0 sur 0 vente(s)</span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-sales-prev" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Précédent</button>
              <button id="btn-sales-next" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Suivant</button>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Historique des Ventes';

    const form = document.getElementById('sales-filter-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');

      this.filters.from = document.getElementById('filter-from').value;
      this.filters.to = document.getElementById('filter-to').value;
      this.filters.status = document.getElementById('filter-status').value;
      this.filters.payment_method = document.getElementById('filter-method').value;
      this.currentPage = 1;

      await withLoading(btn, () => this.loadSales(), "Filtrage des ventes...");
    });

    document.getElementById('btn-reset-filters').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      form.reset();
      this.filters = { from: '', to: '', status: '', payment_method: '' };
      this.currentPage = 1;
      await withLoading(btn, () => this.loadSales(), "Réinitialisation...");
    });

    document.getElementById('btn-export-sales').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try {
        await withLoading(btn, () => API.exports.sales('xlsx', {
          from: this.filters.from || undefined,
          to: this.filters.to || undefined
        }), "Export Excel en cours...");
        Toast.success("Export Excel téléchargé.");
      } catch (err) {
        Toast.error(err.message || "Échec de l'export (peut-être réservé au plan PRO).");
      }
    });

    document.getElementById('btn-sales-prev').addEventListener('click', async (e) => {
      if (this.currentPage > 1) {
        this.currentPage--;
        await withLoading(e.currentTarget, () => this.loadSales(), "Chargement de la page...");
      }
    });

    document.getElementById('btn-sales-next').addEventListener('click', async (e) => {
      if (this.currentPage < this.pagination.pages) {
        this.currentPage++;
        await withLoading(e.currentTarget, () => this.loadSales(), "Chargement de la page...");
      }
    });

    await this.loadSales();
  }

  async loadSales() {
    const tableBody = document.getElementById('sales-table-body');
    tableBody.innerHTML = Skeletons.table(9, 5);

    try {
      const res = await API.sales.list({
        page: this.currentPage,
        limit: 15,
        from: this.filters.from || undefined,
        to: this.filters.to || undefined,
        status: this.filters.status || undefined,
        payment_method: this.filters.payment_method || undefined
      });

      if (!res || (typeof res !== 'object')) {
        throw new Error('Réponse API invalide.');
      }

      const data = res.data || res;
      this.sales = Array.isArray(data?.sales) ? data.sales : [];
      this.pagination = data?.pagination || {};

      document.getElementById('sales-pagination-text').textContent =
        `Affichage de ${this.sales.length} sur ${this.pagination.total || 0} vente(s)`;
      document.getElementById('btn-sales-prev').disabled = this.currentPage === 1;
      document.getElementById('btn-sales-next').disabled = this.currentPage >= (this.pagination.pages || 1);

      if (this.sales.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--text-secondary);">Aucune vente enregistrée.</td></tr>';
        return;
      }

      const fmtAmt = (val) => {
        if (val === null || val === undefined) return 'N/A';
        const n = Number(val);
        return isNaN(n) ? 'N/A' : n.toLocaleString();
      };

      tableBody.innerHTML = this.sales.map(s => {
        const datetime = s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : 'Date inconnue';
        const transactionNumber = escapeHtml(s.transaction_number || 'N/A');
        const sellerName = escapeHtml(s.seller_name || 'Inconnu');
        const methodLabel = s.payment_method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Espèces';
        const discountVal = Number(s.discount_amount || 0);
        const discountText = discountVal > 0 ? `-${discountVal.toLocaleString()}` : '0';
        const statusBadge = s.is_cancelled
          ? '<span class="badge badge-danger">Annulée</span>'
          : '<span class="badge badge-success">Validée</span>';

        return `
          <tr style="${s.is_cancelled ? 'opacity: 0.6;' : ''}">
            <td><strong>${transactionNumber}</strong></td>
            <td>${datetime}</td>
            <td><code style="font-size: 12px;">${sellerName}</code></td>
            <td>${methodLabel}</td>
            <td>${fmtAmt(s.subtotal)}</td>
            <td style="color: var(--error);">${discountText}</td>
            <td style="font-weight: 700;">${fmtAmt(s.total_amount)} FCFA</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-detail" data-id="${escapeAttr(s.id)}" style="padding: 4px 8px; font-size: 11px;">Voir</button>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.querySelectorAll('.btn-detail').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          await withLoading(e.currentTarget, () => this.openDetailModal(e.currentTarget.dataset.id), "Chargement des détails...");
        });
      });

    } catch (e) {
      console.error(e);
      tableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--error);">Erreur de chargement.</td></tr>';
    }
  }

  async openDetailModal(saleId) {
    let raw = null;
    try {
      raw = await API.sales.get(saleId);
    } catch (err) {
      Toast.error(err.message);
      return;
    }

    const sale = raw?.data || raw;

    if (!sale || !sale.id) {
      Toast.error('Données de vente invalides ou introuvables.');
      return;
    }

    const container = document.getElementById('sales-modal-container');
    const currency = 'FCFA';
    const transactionNumber = escapeHtml(sale.transaction_number || 'N/A');
    const sellerName = escapeHtml(sale.seller_name || 'Inconnu');
    const momoReference = escapeHtml(sale.momo_reference || '');

    const formattedDate = sale.created_at
      ? new Date(sale.created_at).toLocaleString('fr-FR')
      : 'Date inconnue';

    const formatAmount = (val) => {
      if (val === null || val === undefined) return null;
      const n = Number(val);
      if (isNaN(n)) return null;
      return n.toLocaleString();
    };

    const subtotal = formatAmount(sale.subtotal);
    const discount = formatAmount(sale.discount_amount);
    const total = formatAmount(sale.total_amount);

    const items = Array.isArray(sale.items) ? sale.items : [];

    const cancelSection = sale.is_cancelled
      ? `<div class="badge badge-danger sale-cancel-badge">Annulée le ${sale.cancelled_at ? new Date(sale.cancelled_at).toLocaleString('fr-FR') : 'Date inconnue'} par un administrateur.</div>`
      : `<button id="btn-modal-cancel-sale" class="btn btn-danger sale-cancel-btn">Annuler cette vente (recrediter les stocks)</button>`;

    container.innerHTML = `
      <div class="card sale-detail-inline" role="dialog" aria-modal="true" aria-labelledby="sale-detail-title">
        <div class="sale-detail-header">
          <h3 id="sale-detail-title">Détail Facture : ${transactionNumber}</h3>
          <button id="panel-close-sale" class="panel-close-btn" title="Fermer (Échap)" aria-label="Fermer le panneau de détail">×</button>
        </div>

        ${cancelSection}

        <div class="sale-info-grid">
          <div class="sale-info-item"><span class="sale-info-label">Date :</span> ${formattedDate}</div>
          <div class="sale-info-item"><span class="sale-info-label">Vendeur :</span> ${sellerName}</div>
          <div class="sale-info-item"><span class="sale-info-label">Mode :</span> ${sale.payment_method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Espèces'}</div>
          ${sale.momo_reference ? `<div class="sale-info-item"><span class="sale-info-label">Réf MoMo :</span> <code class="sale-momo-ref">${momoReference}</code></div>` : ''}
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Article</th>
                <th class="text-center">Qté</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.length > 0
                ? items.map(item => {
                    const itemPrice = formatAmount(item.unit_sell_price);
                    const itemTotal = formatAmount(item.total_price);
                    return `
                    <tr>
                      <td>${escapeHtml(item.product_name || 'Produit inconnu')}<br><small class="text-secondary">${itemPrice !== null ? itemPrice + ' ' + currency : 'N/A'}</small></td>
                      <td class="text-center">${item.quantity || 0}</td>
                      <td class="text-right font-semibold">${itemTotal !== null ? itemTotal + ' ' + currency : 'N/A'}</td>
                    </tr>
                  `;}).join('')
                : '<tr><td colspan="3" class="text-center text-secondary" style="padding: var(--spacing-lg, 24px);">Aucun article associé à cette vente. Vérifiez l\'intégrité de la transaction.</td></tr>'
              }
            </tbody>
          </table>
        </div>

        <div class="sale-totals">
          <div class="sale-total-row">
            <span class="text-secondary">Sous-total :</span>
            <span class="font-semibold">${subtotal !== null ? subtotal + ' ' + currency : 'N/A'}</span>
          </div>
          ${formatAmount(sale.discount_amount) > 0 ? `
            <div class="sale-total-row sale-discount-row">
              <span>Remise :</span>
              <span class="font-semibold">-${discount} ${currency}</span>
            </div>
          ` : ''}
          <div class="sale-total-row sale-total-final">
            <span>TOTAL NET :</span>
            <span>${total !== null ? total + ' ' + currency : 'N/A'}</span>
          </div>
        </div>

        <div class="sale-detail-actions">
          <button id="btn-modal-reprint-ticket" class="btn btn-primary">Imprimer le ticket de caisse</button>
        </div>
      </div>
    `;

    const panel = container.querySelector('.sale-detail-inline');
    const closeFn = () => {
      container.innerHTML = '';
    };

    let releaseDialog = null;
    try {
      releaseDialog = setupDialog(panel, { labelledbyId: 'sale-detail-title', closeFn });
    } catch (_) {}

    document.getElementById('panel-close-sale').addEventListener('click', closeFn);

    document.getElementById('btn-modal-reprint-ticket').addEventListener('click', () => {
      API.sales.openTicket(sale.id).catch((err) => Toast.error(err.message));
    });

    const cancelBtn = document.getElementById('btn-modal-cancel-sale');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (confirm('Êtes-vous sûr de vouloir ANNULER cette vente ? Le stock de tous ses produits sera recrédité en base.')) {
          try {
            await withLoading(cancelBtn, async () => {
              await API.sales.cancel(sale.id);
              closeFn();
              await this.loadSales();
            }, "Annulation de la vente...");
            Toast.success('Vente annulée et stocks recrédités.');
          } catch (err) {
            Toast.error(err.message);
          }
        }
      });
    }
  }
}
