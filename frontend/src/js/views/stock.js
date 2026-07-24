/**
 * Stock Management View
 * Quick stock overview and inline editing for all products.
 * Supports: search, filter by stock level, quick stock adjustments (in/out/adjust).
 */

import { API } from '../api.js';
import { escapeHtml, escapeAttr } from '../utils.js';
import { Toast, withLoading, Skeletons, alertModal } from '../utils/ui.js';

export class StockView {
  constructor() {
    this.products = [];
    this.categories = [];
    this.filteredProducts = [];
    this.searchQuery = '';
    this.stockFilter = 'all'; // all, low, out, ok
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.activeStockModal = null;
  }

  async render() {
    return `
      <div class="fade-in dashboard-page">
        <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 650; margin-bottom: 4px;">Gestion du Stock</h2>
            <p style="color: var(--text-secondary); font-size: 14px;">Modifiez rapidement le stock de vos produits — entrées, sorties et ajustements.</p>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <label style="font-size: 13px; color: var(--text-secondary); font-weight: 500;" for="stock-filter-select">Filtrer :</label>
              <select id="stock-filter-select" class="form-input" style="width: 160px; padding: 8px 12px; font-size: 13px;">
                <option value="all">Tous les produits</option>
                <option value="out">Rupture de stock</option>
                <option value="low">Stock faible</option>
                <option value="ok">Stock suffisant</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Summary Cards -->
        <div class="metric-grid" id="stock-summary" style="margin-bottom: 24px;">
          ${Skeletons.grid(4)}
        </div>

        <!-- Search Bar -->
        <div class="card" style="padding: 16px; margin-bottom: 24px;">
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="flex: 1; position: relative;">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" id="stock-search" class="form-input" placeholder="Rechercher un produit..." aria-label="Rechercher un produit" style="padding-left: 38px; flex: 1;">
            </div>
          </div>
        </div>

        <!-- Products Stock Table -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 16px; font-weight: 600;">Inventaire des produits</h3>
            <span id="stock-count" style="font-size: 13px; color: var(--text-secondary);">Chargement...</span>
          </div>
          <div class="table-responsive">
            <table class="table" id="stock-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th style="text-align: center;">Catégorie</th>
                  <th style="text-align: center;">Stock actuel</th>
                  <th style="text-align: center;">Seuil d'alerte</th>
                  <th style="text-align: center;">Statut</th>
                  <th style="text-align: right;">Actions rapides</th>
                </tr>
              </thead>
              <tbody id="stock-table-body">
                <tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">Chargement...</td></tr>
              </tbody>
            </table>
          </div>
          <div id="stock-pagination" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid var(--border-color);">
            <span id="stock-page-info" style="font-size: 13px; color: var(--text-secondary);"></span>
            <div style="display: flex; gap: 8px;">
              <button id="stock-prev" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" disabled>Précédent</button>
              <button id="stock-next" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" disabled>Suivant</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Gestion du Stock';

    // Bind events
    const searchInput = document.getElementById('stock-search');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.currentPage = 1;
        this.applyFilters();
      }, 300);
    });

    const filterSelect = document.getElementById('stock-filter-select');
    filterSelect.addEventListener('change', (e) => {
      this.stockFilter = e.target.value;
      this.currentPage = 1;
      this.applyFilters();
    });

    document.getElementById('stock-prev').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderTable();
      }
    });

    document.getElementById('stock-next').addEventListener('click', () => {
      const maxPage = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        this.renderTable();
      }
    });

    // Load data
    await this.loadData();
  }

  async loadData() {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        API.products.list({ limit: 100 }),
        API.categories.list()
      ]);

      this.products = productsRes?.data?.products || productsRes?.products || productsRes?.data || [];
      this.categories = categoriesRes?.data?.categories || categoriesRes?.categories || categoriesRes?.data || [];

      this.renderSummary();
      this.applyFilters();
    } catch (error) {
      console.error('[Stock] Error loading data:', error);
      Toast.error('Erreur lors du chargement des produits.');
      document.getElementById('stock-table-body').innerHTML = `
        <tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--error);">
          Erreur de chargement. <button class="btn btn-secondary btn-sm" onclick="location.reload()" style="margin-left: 8px;">Réessayer</button>
        </td></tr>
      `;
    }
  }

  renderSummary() {
    const total = this.products.length;
    const outOfStock = this.products.filter(p => p.stock_quantity === 0).length;
    const lowStock = this.products.filter(p => {
      const threshold = p.stock_threshold !== null ? p.stock_threshold : 20;
      return p.stock_quantity > 0 && p.stock_quantity <= threshold;
    }).length;
    const okStock = total - outOfStock - lowStock;

    const summaryEl = document.getElementById('stock-summary');
    if (!summaryEl) return;

    const cards = [
      { label: 'Total produits', value: total, color: 'var(--text-primary)', icon: '<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4"/>' },
      { label: 'Stock suffisant', value: okStock, color: 'var(--success)', icon: '<path d="M5 13l4 4L19 7"/>' },
      { label: 'Stock faible', value: lowStock, color: 'var(--warning)', icon: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>' },
      { label: 'Rupture de stock', value: outOfStock, color: 'var(--error)', icon: '<path d="M6 18L18 6M6 6l12 12"/>' }
    ];

    summaryEl.innerHTML = cards.map(c => `
      <div class="metric-card" style="min-height: 100px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span class="metric-label">${c.label}</span>
          <span style="color: ${c.color}; display: flex; align-items: center;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${c.icon}</svg>
          </span>
        </div>
        <span class="metric-value" style="color: ${c.color};">${c.value}</span>
      </div>
    `).join('');
  }

  applyFilters() {
    let filtered = [...this.products];

    // Search filter
    if (this.searchQuery) {
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(this.searchQuery) ||
        p.sku?.toLowerCase().includes(this.searchQuery)
      );
    }

    // Stock level filter
    switch (this.stockFilter) {
      case 'out':
        filtered = filtered.filter(p => p.stock_quantity === 0);
        break;
      case 'low':
        filtered = filtered.filter(p => {
          const threshold = p.stock_threshold !== null ? p.stock_threshold : 20;
          return p.stock_quantity > 0 && p.stock_quantity <= threshold;
        });
        break;
      case 'ok':
        filtered = filtered.filter(p => {
          const threshold = p.stock_threshold !== null ? p.stock_threshold : 20;
          return p.stock_quantity > threshold;
        });
        break;
    }

    this.filteredProducts = filtered;
    this.renderTable();
  }

  renderTable() {
    const tbody = document.getElementById('stock-table-body');
    if (!tbody) return;

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageItems = this.filteredProducts.slice(start, end);
    const totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);

    // Update count
    const countEl = document.getElementById('stock-count');
    if (countEl) {
      countEl.textContent = `${this.filteredProducts.length} produit(s)`;
    }

    // Update pagination
    const pageInfo = document.getElementById('stock-page-info');
    if (pageInfo) {
      pageInfo.textContent = this.filteredProducts.length === 0
        ? 'Aucun produit'
        : `Page ${this.currentPage} sur ${totalPages}`;
    }
    const prevBtn = document.getElementById('stock-prev');
    const nextBtn = document.getElementById('stock-next');
    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px;">
            <div class="empty-state">
              <strong>Aucun produit trouvé</strong>
              <span>Modifiez vos filtres ou ajoutez des produits.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(p => {
      const threshold = p.stock_threshold !== null ? p.stock_threshold : 20;
      const isOut = p.stock_quantity === 0;
      const isLow = p.stock_quantity > 0 && p.stock_quantity <= threshold;
      const statusBadge = isOut
        ? '<span class="badge badge-danger">Rupture</span>'
        : (isLow ? '<span class="badge badge-warning">Faible</span>' : '<span class="badge badge-success">OK</span>');

      const category = this.categories.find(c => c.id === p.category_id);
      const categoryName = category ? escapeHtml(category.name) : '—';

      const imageHtml = p.image_url
        ? `<img src="${escapeAttr(p.image_url)}" alt="Photo de ${escapeAttr(p.name)}" style="width: 40px; height: 40px; border-radius: var(--radius); object-fit: cover; background: var(--bg-tertiary);">`
        : `<div style="width: 40px; height: 40px; border-radius: var(--radius); background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 12px; font-weight: 600;">${escapeHtml(p.name?.charAt(0)?.toUpperCase() || '?')}</div>`;

      return `
        <tr>
          <td data-label="Produit">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${imageHtml}
              <div>
                <div style="font-weight: 600; font-size: 14px;">${escapeHtml(p.name)}</div>
                ${p.sku ? `<div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(p.sku)}</div>` : ''}
              </div>
            </div>
          </td>
          <td data-label="Catégorie" style="text-align: center;"><span style="background: var(--bg-tertiary); padding: 2px 8px; border-radius: 12px; font-size: 11px;">${categoryName}</span></td>
          <td data-label="Stock actuel" style="text-align: center;">
            <span style="font-size: 16px; font-weight: 700; color: ${isOut ? 'var(--error)' : (isLow ? 'var(--warning)' : 'var(--text-primary)')};">${p.stock_quantity}</span>
          </td>
          <td data-label="Seuil d'alerte" style="text-align: center; color: var(--text-secondary);">${threshold}</td>
          <td data-label="Statut" style="text-align: center;">${statusBadge}</td>
          <td data-label="Actions rapides" style="text-align: right;">
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-quick-stock" data-id="${escapeAttr(p.id)}" data-type="in" title="Ajouter du stock" aria-label="Ajouter du stock pour ${escapeAttr(p.name)}" style="padding: 6px 10px; font-size: 12px; min-height: 36px; min-width: 36px; display: inline-flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                Entrée
              </button>
              <button class="btn btn-secondary btn-quick-stock" data-id="${escapeAttr(p.id)}" data-type="out" title="Retirer du stock" aria-label="Retirer du stock pour ${escapeAttr(p.name)}" style="padding: 6px 10px; font-size: 12px; min-height: 36px; min-width: 36px; display: inline-flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" fill="none" stroke="var(--error)" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
                Sortie
              </button>
              <button class="btn btn-secondary btn-quick-stock" data-id="${escapeAttr(p.id)}" data-type="adjust" title="Ajuster le stock" aria-label="Ajuster le stock pour ${escapeAttr(p.name)}" style="padding: 6px 10px; font-size: 12px; min-height: 36px; min-width: 36px; display: inline-flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 8h16M4 16h16M10 4v16M14 4v16"/></svg>
                Ajuster
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind quick stock buttons
    tbody.querySelectorAll('.btn-quick-stock').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const type = e.currentTarget.dataset.type;
        const product = this.products.find(p => p.id == id);
        if (product) {
          this.openQuickStockModal(product, type);
        }
      });
    });
  }

  openQuickStockModal(product, type) {
    // Remove existing modal
    if (this.activeStockModal) {
      this.activeStockModal.remove();
    }

    const typeLabels = {
      in: { title: 'Entrée de stock', label: 'Quantité à ajouter', placeholder: 'Ex: 10', btnText: 'Valider l\'entrée', btnClass: 'btn-primary', icon: '<path d="M12 5v14M5 12h14"/>' },
      out: { title: 'Sortie de stock', label: 'Quantité à retirer', placeholder: 'Ex: 5', btnText: 'Valider la sortie', btnClass: 'btn-danger', icon: '<path d="M5 12h14"/>' },
      adjust: { title: 'Ajustement de stock', label: 'Nouveau stock total', placeholder: 'Ex: 50', btnText: 'Ajuster', btnClass: 'btn-primary', icon: '<path d="M4 8h16M4 16h16M10 4v16M14 4v16"/>' }
    };

    const config = typeLabels[type];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '1100';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 460px;">
        <div class="modal-header">
          <h3 style="font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${config.icon}</svg>
            ${config.title}
          </h3>
          <button class="panel-close-btn" data-close aria-label="Fermer la fenêtre" style="width: 36px; height: 36px; font-size: 20px;">×</button>
        </div>
        <div class="modal-body">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius);">
            ${product.image_url
              ? `<img src="${escapeAttr(product.image_url)}" alt="Photo de ${escapeAttr(product.name)}" style="width: 48px; height: 48px; border-radius: var(--radius); object-fit: cover;">`
              : `<div style="width: 48px; height: 48px; border-radius: var(--radius); background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--text-secondary);">${escapeHtml(product.name?.charAt(0)?.toUpperCase() || '?')}</div>`
            }
            <div>
              <div style="font-weight: 600; font-size: 14px;">${escapeHtml(product.name)}</div>
              <div style="font-size: 13px; color: var(--text-secondary);">Stock actuel : <strong style="color: var(--text-primary);">${product.stock_quantity}</strong></div>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" for="quick-stock-qty">${config.label}</label>
            <input type="number" id="quick-stock-qty" class="form-input" placeholder="${config.placeholder}" min="${type === 'adjust' ? '0' : '1'}" required style="font-size: 16px; font-weight: 600;">
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="quick-stock-reason">Motif</label>
            <input type="text" id="quick-stock-reason" class="form-input" placeholder="Ex: Réception commande, perte, inventaire..." style="font-size: 14px;" required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-close style="font-size: 13px;">Annuler</button>
          <button class="btn ${config.btnClass}" id="btn-confirm-quick-stock" style="font-size: 13px;">${config.btnText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.activeStockModal = modal;

    // Focus the quantity input
    setTimeout(() => {
      document.getElementById('quick-stock-qty')?.focus();
    }, 100);

    // Close handlers
    modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.remove();
        this.activeStockModal = null;
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        this.activeStockModal = null;
      }
    });

    // Confirm handler
    const confirmBtn = document.getElementById('btn-confirm-quick-stock');
    confirmBtn.addEventListener('click', async () => {
      const qty = parseInt(document.getElementById('quick-stock-qty').value, 10);
      const reason = document.getElementById('quick-stock-reason').value.trim();

      if (!qty || qty < 0 || (type !== 'adjust' && qty < 1)) {
        alertModal('Veuillez entrer une quantité valide.', { title: 'Validation' });
        return;
      }
      if (!reason || reason.length < 3) {
        alertModal('Veuillez saisir un motif (min. 3 caractères).', { title: 'Validation' });
        return;
      }

      const payload = {
        movement_type: type === 'in' ? 'IN' : type === 'out' ? 'OUT' : 'ADJUSTMENT',
        quantity: qty,
        reason
      };

      try {
        await withLoading(confirmBtn, async () => {
          await API.products.stockMovement(product.id, payload);
        });

        alertModal('Stock mis à jour avec succès.', { title: 'Stock' });

        // Update local data
        if (type === 'in') {
          product.stock_quantity += qty;
        } else if (type === 'out') {
          product.stock_quantity = Math.max(0, product.stock_quantity - qty);
        } else {
          product.stock_quantity = qty;
        }

        modal.remove();
        this.activeStockModal = null;

        // Re-render
        this.renderSummary();
        this.applyFilters();
      } catch (error) {
        console.error('[Stock] Error updating stock:', error);
        alertModal(error.message || 'Erreur lors de la mise à jour du stock.', { title: 'Erreur' });
      }
    });

    // Enter key submits
    document.getElementById('quick-stock-qty').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBtn.click();
      }
    });
  }
}