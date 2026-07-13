import { API } from '../api.js';
import { escapeAttr, escapeHtml } from '../utils.js';
import { Toast, withLoading, Skeletons, confirmModal, alertModal } from '../utils/ui.js';
import { setupDialog } from '../utils/aria.js';

export class ProductsView {
  constructor(queryParams = {}) {
    this.queryParams = queryParams;
    this.currentCategory = null;
    this.searchQuery = '';
    this.showTrash = false;
    this.categories = [];
    this.products = [];
    this.pagination = {};
    this.currentPage = 1;
  }

  async render() {
    return `
      <div class="fade-in">
        <!-- Barre d'actions supérieure -->
        <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div style="display: flex; gap: 12px; flex: 1; max-width: 500px;">
            <input type="text" id="prod-search" class="form-input" placeholder="Rechercher par nom ou SKU..." aria-label="Rechercher un produit par nom ou SKU" style="flex: 1;">
            <select id="prod-cat-filter" class="form-input" aria-label="Filtrer par catégorie" style="width: 180px;">
              <option value="">Toutes catégories</option>
            </select>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button id="btn-toggle-trash" class="btn btn-secondary">
              <span id="trash-btn-text">Corbeille</span>
            </button>
            <button id="btn-new-cat" class="btn btn-secondary">Nouvelle categorie</button>
            <button id="btn-new-prod" class="btn btn-primary">Nouveau produit</button>
          </div>
        </div>

        <!-- Zone d'affichage principal (Catalogue / Corbeille) -->
        <div class="card">
          <h3 id="catalog-title" style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Catalogue des Produits</h3>
          
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Produit</th>
                  <th>SKU</th>
                  <th>Catégorie</th>
                  <th>P. Achat</th>
                  <th>P. Vente</th>
                  <th style="text-align: center;">Stock</th>
                  <th style="text-align: center;">Date Péremption</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="products-table-body">
                <!-- Rempli par JavaScript -->
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div id="pagination-container" style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
            <span id="pagination-text" style="font-size: 13px; color: var(--text-secondary);">Affichage 0 de 0</span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-page-prev" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Précédent</button>
              <button id="btn-page-next" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Suivant</button>
            </div>
          </div>
        </div>

        <!-- Modales injectées dynamiquement -->
        <div id="modal-container"></div>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Gestion des Produits';
    
    // Attacher les écouteurs d'événements principaux
    document.getElementById('prod-search').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.currentPage = 1;
      this.loadProducts();
    });

    document.getElementById('prod-cat-filter').addEventListener('change', (e) => {
      this.currentCategory = e.target.value || null;
      this.currentPage = 1;
      this.loadProducts();
    });

    document.getElementById('btn-toggle-trash').addEventListener('click', () => {
      this.showTrash = !this.showTrash;
      const text = this.showTrash ? 'Catalogue' : 'Corbeille';
      document.getElementById('trash-btn-text').textContent = text;
      document.getElementById('catalog-title').textContent = this.showTrash ? 'Produits en corbeille' : 'Catalogue des Produits';
      
      // Masquer/Afficher les boutons d'ajout selon la corbeille
      document.getElementById('btn-new-prod').style.display = this.showTrash ? 'none' : 'block';
      
      this.currentPage = 1;
      this.loadProducts();
    });

    document.getElementById('btn-new-prod').addEventListener('click', () => this.openProductModal());
    document.getElementById('btn-new-cat').addEventListener('click', () => this.openCategoryModal());

    document.getElementById('btn-page-prev').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadProducts();
      }
    });

    document.getElementById('btn-page-next').addEventListener('click', () => {
      if (this.currentPage < this.pagination.pages) {
        this.currentPage++;
        this.loadProducts();
      }
    });

    // Chargement initial des catégories
    await this.loadCategories();
    // Chargement initial des produits
    await this.loadProducts();

    if (this.queryParams.new === '1' && !this.showTrash) {
      await this.openProductModal();
    }
  }

  /**
   * Charge la liste des catégories dans le filtre.
   */
  async loadCategories() {
    try {
      this.categories = await API.categories.list();
      const filter = document.getElementById('prod-cat-filter');
      // Conserver l'option vide
      filter.innerHTML = '<option value="">Toutes catégories</option>' + 
        this.categories.map(c => `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Charge la liste des produits avec filtres.
   */
  async loadProducts() {
    const tableBody = document.getElementById('products-table-body');
    tableBody.innerHTML = Skeletons.table(9, 5);

    try {
      let data;
      if (this.showTrash) {
        const res = await API.products.listTrash();
        data = { products: res.data, pagination: { page: 1, limit: 100, total: res.data.length, pages: 1 } };
      } else {
        data = await API.products.list({
          page: this.currentPage,
          limit: 15,
          search: this.searchQuery || undefined,
          category_id: this.currentCategory || undefined
        });
      }

      this.products = data.products;
      this.pagination = data.pagination;

      // Mettre à jour le statut pagination
      document.getElementById('pagination-text').textContent = 
        `Affichage de ${this.products.length} sur ${this.pagination.total} produit(s)`;
      document.getElementById('btn-page-prev').disabled = this.currentPage === 1;
      document.getElementById('btn-page-next').disabled = this.currentPage >= this.pagination.pages;

      if (this.products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--text-secondary);">Aucun produit trouvé.</td></tr>';
        return;
      }

      tableBody.innerHTML = this.products.map(p => {
        const imageUrl = p.image_url ? p.image_url : 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'><rect width=\'40\' height=\'40\' rx=\'6\' fill=\'#f1f1ef\'/><text x=\'20\' y=\'26\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'16\' font-weight=\'700\' fill=\'#8c9196\'>P</text></svg>');
        const productName = escapeHtml(p.name);
        const sku = escapeHtml(p.sku || '-');
        const categoryName = escapeHtml(p.category_name || 'Autres');
        
        // Formater date expiration
        let expiryText = '-';
        let isExpired = false;
        if (p.has_expiry && p.expiry_date) {
          const expDate = new Date(p.expiry_date);
          expiryText = expDate.toLocaleDateString('fr-FR');
          isExpired = expDate.getTime() < Date.now();
        }

        // Vérification seuil d'alerte stock
        const isLowStock = p.stock_quantity <= (p.stock_threshold !== null ? p.stock_threshold : 20);
        const stockBadgeClass = p.stock_quantity === 0 
          ? 'badge-danger' 
          : (isLowStock ? 'badge-warning' : 'badge-success');

        let actionButtons = '';
        if (this.showTrash) {
          actionButtons = `
            <button class="btn btn-secondary btn-restore" data-id="${escapeAttr(p.id)}" style="padding: 4px 8px; font-size: 11px;">Restaurer</button>
          `;
        } else {
          actionButtons = `
            <button class="btn btn-secondary btn-stock" data-id="${escapeAttr(p.id)}" style="padding: 4px 8px; font-size: 11px;">Stock</button>
            <button class="btn btn-secondary btn-edit" data-id="${escapeAttr(p.id)}" style="padding: 4px 8px; font-size: 11px;">Modifier</button>
            <button class="btn btn-danger btn-delete" data-id="${escapeAttr(p.id)}" style="padding: 4px 8px; font-size: 11px;">Supprimer</button>
          `;
        }

        return `
          <tr>
            <td data-label="Image"><img src="${escapeAttr(imageUrl)}" alt="photo" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: var(--bg-tertiary);"></td>
            <td data-label="Produit"><strong>${productName}</strong></td>
            <td data-label="SKU"><code>${sku}</code></td>
            <td data-label="Catégorie"><span class="badge" style="background: var(--bg-tertiary);">${categoryName}</span></td>
            <td data-label="P. Achat">${Number(p.purchase_price).toLocaleString()}</td>
            <td data-label="P. Vente" style="font-weight: 600;">${Number(p.sell_price).toLocaleString()} FCFA</td>
            <td data-label="Stock" style="text-align: center;">
              <span class="badge ${stockBadgeClass}">${p.stock_quantity}</span>
            </td>
            <td data-label="Date Péremption" style="text-align: center; ${isExpired ? 'color: var(--error); font-weight: 600;' : ''}">
              ${expiryText} ${isExpired ? '<br><small>(Expiré)</small>' : ''}
            </td>
            <td data-label="Actions" style="text-align: right;">${actionButtons}</td>
          </tr>
        `;
      }).join('');

      // Attacher les écouteurs d'actions
      tableBody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => this.openProductModal(e.target.dataset.id));
      });

      tableBody.querySelectorAll('.btn-stock').forEach(btn => {
        btn.addEventListener('click', (e) => this.openStockModal(e.target.dataset.id));
      });

      tableBody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const confirmed = await confirmModal('Voulez-vous vraiment envoyer ce produit à la corbeille ?', { title: 'Supprimer le produit', confirmText: 'Supprimer', danger: true });
          if (confirmed) {
            try {
              await withLoading(e.target, async () => {
                await API.products.delete(e.target.dataset.id);
                await this.loadProducts();
              }, "Suppression...");
              alertModal('Produit supprimé avec succès.', { title: 'Suppression' });
            } catch (err) {
              alertModal(err.message, { title: 'Erreur' });
            }
          }
        });
      });

      tableBody.querySelectorAll('.btn-restore').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          try {
            await withLoading(e.target, async () => {
              await API.products.restore(e.target.dataset.id);
              await this.loadProducts();
            }, "Restauration...");
            alertModal('Produit restauré avec succès.', { title: 'Restauration' });
          } catch (err) {
            alertModal(err.message, { title: 'Erreur' });
          }
        });
      });

    } catch (e) {
      console.error(e);
      tableBody.innerHTML = '<tr><td colspan="9" class="text-center" style="color: var(--error);">Une erreur est survenue lors du chargement.</td></tr>';
    }
  }

  /**
   * Ouvre la modale de création / édition de produit.
   */
  async openProductModal(productId = null) {
    const isEdit = !!productId;
    let product = null;

    if (isEdit) {
      try {
        const res = await API.products.get(productId);
        product = res.data;
      } catch (err) {
        Toast.error(err.message);
        return;
      }
    }

    const container = document.getElementById('modal-container');
    const productName = escapeAttr(product?.name || '');
    const productSku = escapeAttr(product?.sku || '');
    const productDescription = escapeHtml(product?.description || '');
    const expiryValue = escapeAttr(product?.expiry_date ? product.expiry_date.split('T')[0] : '');

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 650px;">
          <div class="modal-header">
            <h3 id="product-modal-title" style="font-size: 16px; font-weight: 600;">${isEdit ? 'Modifier' : 'Nouveau'} Produit</h3>
            <button id="modal-close" style="font-size: 20px;" aria-label="Fermer la fenêtre">×</button>
          </div>
          
          <form id="product-form">
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">Désignation du produit</label>
                  <input type="text" id="prod-name" class="form-input" value="${productName}" placeholder="Doliprane 500mg" required>
                </div>
                
                <div class="form-group">
                  <label class="form-label">Catégorie</label>
                  <select id="prod-category" class="form-input" required>
                    <option value="">-- Choisir une catégorie --</option>
                    ${this.categories.map(c => `<option value="${escapeAttr(c.id)}" ${product?.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">SKU (Facultatif)</label>
                  <input type="text" id="prod-sku" class="form-input" value="${productSku}" placeholder="Laissez vide pour auto-générer">
                </div>

                <div class="form-group">
                  <label class="form-label">Prix d'achat (FCFA)</label>
                  <input type="number" id="prod-price-purchase" class="form-input" value="${product?.purchase_price || ''}" min="0.01" step="0.01" required>
                </div>

                <div class="form-group">
                  <label class="form-label">Prix de vente (FCFA)</label>
                  <input type="number" id="prod-price-sell" class="form-input" value="${product?.sell_price || ''}" min="0.01" step="0.01" required>
                </div>

                <div class="form-group">
                  <label class="form-label">Quantité en stock</label>
                  <input type="number" id="prod-qty" class="form-input" value="${product?.stock_quantity ?? 0}" min="0" required ${isEdit ? 'disabled' : ''}>
                  ${isEdit ? '<small style="color: var(--text-secondary)">Le stock se gère via le bouton « Stock » (entrées/sorties/ajustements traced).</small>' : ''}
                </div>

                <div class="form-group">
                  <label class="form-label">Seuil d'alerte stock (Facultatif)</label>
                  <input type="number" id="prod-threshold" class="form-input" value="${product?.stock_threshold ?? ''}" min="0" placeholder="Utilise le seuil global sinon">
                </div>

                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">Photo du produit (JPEG, PNG, WebP - Max 2 Mo)</label>
                  <input type="file" id="prod-photo" accept="image/jpeg,image/png,image/webp">
                </div>

                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="prod-has-expiry" ${product?.has_expiry ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--accent-color);">
                    Produit périssable (gérer la date de péremption)
                  </label>
                </div>

                <div class="form-group" id="expiry-date-container" style="grid-column: span 2; display: ${product?.has_expiry ? 'block' : 'none'};">
                  <label class="form-label">Date de péremption</label>
                  <input type="date" id="prod-expiry-date" class="form-input" value="${expiryValue}">
                </div>

                <div class="form-group" style="grid-column: span 2;">
                  <label class="form-label">Description / Remarques</label>
                  <textarea id="prod-description" class="form-input" style="height: 80px; resize: none;" placeholder="Indications, informations fournisseurs...">${productDescription}</textarea>
                </div>
              </div>

            </div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary modal-close-btn">Annuler</button>
              <button type="submit" class="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Attacher événements de fermeture
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = container.querySelector('.modal-close-btn');
    const closeFn = () => container.innerHTML = '';
    closeBtn.addEventListener('click', closeFn);
    cancelBtn.addEventListener('click', closeFn);

    // Accessibilité : transformer .modal-content en role=dialog + trap focus + Escape
    const dialogEl = container.querySelector('.modal-content');
    setupDialog(dialogEl, { labelledbyId: 'product-modal-title', closeFn });

    // Gérer l'affichage conditionnel de la date d'expiration
    const checkbox = document.getElementById('prod-has-expiry');
    const expiryContainer = document.getElementById('expiry-date-container');
    checkbox.addEventListener('change', (e) => {
      expiryContainer.style.display = e.target.checked ? 'block' : 'none';
      if (!e.target.checked) {
        document.getElementById('prod-expiry-date').value = '';
      }
    });

    // Gérer la soumission du formulaire
    const form = document.getElementById('product-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData();
      formData.append('name', document.getElementById('prod-name').value.trim());
      formData.append('category_id', document.getElementById('prod-category').value);
      formData.append('sku', document.getElementById('prod-sku').value.trim());
      formData.append('purchase_price', document.getElementById('prod-price-purchase').value);
      formData.append('sell_price', document.getElementById('prod-price-sell').value);

      if (!isEdit) {
        formData.append('stock_quantity', document.getElementById('prod-qty').value);
      }

      const thresholdVal = document.getElementById('prod-threshold').value;
      if (thresholdVal !== '') {
        formData.append('stock_threshold', thresholdVal);
      }

      const hasExpiry = document.getElementById('prod-has-expiry').checked;
      formData.append('has_expiry', hasExpiry ? 'true' : 'false');
      if (hasExpiry) {
        formData.append('expiry_date', document.getElementById('prod-expiry-date').value);
      }

      formData.append('description', document.getElementById('prod-description').value.trim());

      const photoFile = document.getElementById('prod-photo').files[0];
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const btn = form.querySelector('button[type="submit"]');
      try {
        await withLoading(btn, async () => {
          if (isEdit) {
            await API.products.update(productId, formData);
          } else {
            await API.products.create(formData);
            localStorage.setItem('rdg_setup_product_created', 'true');
          }
          closeFn();
          await this.loadProducts();

          if (!isEdit && this.queryParams.fromSetup === '1') {
            window.location.hash = '#/dashboard';
          }
          alertModal(isEdit ? 'Produit mis à jour avec succès.' : 'Produit créé avec succès.', { title: isEdit ? 'Modification' : 'Création' });
        }, "Enregistrement du produit...");
      } catch (err) {
        alertModal(err.message, { title: 'Erreur' });
      }
    });
  }

  /**
   * Ouvre la modale de création de catégorie.
   */
  openCategoryModal() {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="category-modal-title" style="font-size: 16px; font-weight: 600;">Nouvelle categorie</h3>
            <button id="modal-close" style="font-size: 20px;" aria-label="Fermer la fenêtre">×</button>
          </div>
          
          <form id="category-form">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Nom de la catégorie</label>
                <input type="text" id="cat-name" class="form-input" placeholder="Boissons chaudes" required>
              </div>
              <p style="font-size: 12px; color: var(--text-secondary);">Remarque : Les catégories personnalisées nécessitent un abonnement au plan **PRO**.</p>
            </div>
            
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary modal-close-btn">Annuler</button>
              <button type="submit" class="btn btn-primary">Créer</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeFn = () => container.innerHTML = '';
    document.getElementById('modal-close').addEventListener('click', closeFn);
    container.querySelector('.modal-close-btn').addEventListener('click', closeFn);

    setupDialog(container.querySelector('.modal-content'), { labelledbyId: 'category-modal-title', closeFn });

    const form = document.getElementById('category-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value.trim();

      const btn = form.querySelector('button[type="submit"]');
      try {
        await withLoading(btn, async () => {
          await API.categories.create(name);
          closeFn();
          await this.loadCategories();
          alertModal('Catégorie créée avec succès.', { title: 'Catégorie' });
        }, "Création de la catégorie...");
      } catch (err) {
        if (err.code === 'PRO_REQUIRED') {
          alertModal('Fonctionnalité Premium. Veuillez vous abonner à l\'offre PRO pour créer vos propres catégories.', { title: 'Fonctionnalité Premium' });
        } else {
          alertModal(err.message, { title: 'Erreur' });
        }
      }
    });
  }

  async openStockModal(productId) {
    let product = null;
    let movements = { movements: [], pagination: { total: 0 } };

    try {
      const prodRes = await API.products.get(productId);
      product = prodRes.data;
      const movRes = await API.products.listStockMovements(productId, { limit: 10 });
      movements = movRes.data || movRes;
    } catch (err) {
      Toast.error(err.message);
      return;
    }

    const container = document.getElementById('modal-container');
    const currentStock = product.stock_quantity ?? 0;

    container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h3 id="stock-modal-title" style="font-size: 16px; font-weight: 600;">Gestion de stock — ${escapeHtml(product.name)}</h3>
            <button id="modal-close" style="font-size: 20px;" aria-label="Fermer la fenêtre">×</button>
          </div>
          
          <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
              <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Stock actuel</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">${currentStock}</div>
              </div>
              <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Seuil d'alerte</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">${product.stock_threshold ?? 20}</div>
              </div>
            </div>

            <form id="stock-movement-form">
              <div class="form-group">
                <label class="form-label">Type de mouvement</label>
                <select id="movement-type" class="form-input" required>
                  <option value="IN">Entrée de stock (IN)</option>
                  <option value="OUT">Sortie de stock (OUT)</option>
                  <option value="ADJUSTMENT">Ajustement manuel (ADJUSTMENT)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" id="quantity-label">Quantité à ajouter/retirer</label>
                <input type="number" id="movement-quantity" class="form-input" min="1" placeholder="Ex: 50" required>
                <small id="quantity-help" style="color: var(--text-secondary);">Pour ADJUSTMENT, saisissez le NOUVEAU stock total.</small>
              </div>

              <div class="form-group">
                <label class="form-label">Motif</label>
                <input type="text" id="movement-reason" class="form-input" placeholder="Ex: Réassort, Inventaire, Perte..." maxlength="100" required>
              </div>

              <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
                <button type="button" id="modal-cancel" class="btn btn-secondary">Annuler</button>
                <button type="submit" class="btn btn-primary">Valider le mouvement</button>
              </div>
            </form>

            <hr style="margin: 24px 0; border: none; border-top: 1px solid var(--border);">

            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Historique des mouvements</h4>
            <div style="max-height: 200px; overflow-y: auto;">
              ${movements.movements?.length > 0 ? `
                <table class="table" style="font-size: 12px;">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Qté</th>
                      <th>Ancien → Nouveau</th>
                      <th>Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${movements.movements.map(m => `
                      <tr>
                        <td>${new Date(m.created_at).toLocaleDateString('fr-FR')} ${new Date(m.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</td>
                        <td><span style="font-weight: 600; color: ${m.movement_type === 'IN' ? 'var(--success)' : m.movement_type === 'OUT' ? 'var(--error)' : 'var(--warning)'};">${escapeHtml(m.movement_type)}</span></td>
                        <td>${m.quantity}</td>
                        <td>${m.old_stock} → ${m.new_stock}</td>
                        <td>${escapeHtml(m.reason)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px;">Aucun mouvement enregistré.</p>'}
            </div>
            ${movements.pagination?.total > 10 ? `<p style="font-size: 12px; color: var(--text-secondary); text-align: center; margin-top: 8px;">${movements.pagination.total} mouvements au total — consultez les logs pour plus de détails.</p>` : ''}
          </div>
        </div>
      </div>
    `;

    const closeFn = () => container.innerHTML = '';
    document.getElementById('modal-close').addEventListener('click', closeFn);
    document.getElementById('modal-cancel').addEventListener('click', closeFn);

    setupDialog(container.querySelector('.modal-content'), { labelledbyId: 'stock-modal-title', closeFn });

    const movementTypeSelect = document.getElementById('movement-type');
    const quantityLabel = document.getElementById('quantity-label');
    const quantityInput = document.getElementById('movement-quantity');

    const updateLabels = () => {
      const type = movementTypeSelect.value;
      if (type === 'IN') {
        quantityLabel.textContent = 'Quantité à ajouter';
      } else if (type === 'OUT') {
        quantityLabel.textContent = 'Quantité à retirer';
        quantityInput.max = currentStock.toString();
      } else {
        quantityLabel.textContent = 'NOUVEAU stock total';
        quantityInput.min = '0';
      }
    };

    movementTypeSelect.addEventListener('change', updateLabels);
    updateLabels();

    const form = document.getElementById('stock-movement-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const movement_type = document.getElementById('movement-type').value;
      const quantity = parseInt(document.getElementById('movement-quantity').value, 10);
      const reason = document.getElementById('movement-reason').value.trim();

      const btn = form.querySelector('button[type="submit"]');
      try {
        await withLoading(btn, async () => {
          await API.products.stockMovement(productId, { movement_type, quantity, reason });
        }, "Traitement...");
        closeFn();
        alertModal('Mouvement de stock enregistré avec succès.', { title: 'Stock' });
        await this.loadProducts();
      } catch (err) {
        alertModal(err.message, { title: 'Erreur' });
      }
    });
  }
}
