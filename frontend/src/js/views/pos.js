import { API } from '../api.js';
import { escapeAttr, escapeHtml } from '../utils.js';
import { Toast, withLoading, Skeletons } from '../utils/ui.js';
import { setupDialog } from '../utils/aria.js';

export class POSView {
  constructor() {
    this.products = [];
    this.categories = [];
    this.cart = [];

    // Restore cart from localStorage (persistence across navigation)
    try {
      const savedCart = localStorage.getItem('pos_cart');
      if (savedCart) {
        this.cart = JSON.parse(savedCart);
      }
    } catch (_) { /* ignore parse errors */ }

    // Filtres catalogue
    this.searchQuery = '';
    this.selectedCategoryId = '';

    // Remise & Paiement
    this.discountType = null; // 'FIXED' | 'PERCENTAGE' | null
    this.discountValue = 0;
    this.paymentMethod = 'CASH'; // 'CASH' | 'MOBILE_MONEY'

    // Raccourcis clavier handler
    this.boundKeydown = this.handleShortcuts.bind(this);
  }

  async render() {
    return `
      <div class="pos-container fade-in">
        <!-- Colonne GAUCHE : Catalogue produits -->
        <div class="pos-catalog">
          <div class="pos-search-bar">
            <input type="text" id="pos-search-input" class="form-input" placeholder="Rechercher un produit ou SKU... (F10)" aria-label="Rechercher un produit ou SKU" style="flex: 1; font-size: 15px;">
          </div>

          <div class="pos-categories" id="pos-cat-tabs">
            <!-- Injecté par JS -->
          </div>

          <div class="pos-grid" id="pos-products-grid">
            <!-- Injecté par JS -->
          </div>
        </div>

        <!-- Colonne DROITE : Panier de vente -->
        <div class="pos-cart">
          <div class="cart-header">
            <h3 style="font-size: 15px; font-weight: 600;">Panier POS</h3>
            <button id="btn-clear-cart" class="btn btn-secondary" style="padding: 8px 12px; font-size: 12px; color: var(--error); min-width: 44px; min-height: 44px;" title="Vider le panier">Vider</button>
          </div>

          <div class="cart-items" id="pos-cart-items">
            <!-- Injecté par JS -->
            <div class="text-center" style="color: var(--text-secondary); margin: auto 0; font-size: 13px;">Panier vide. Cliquez sur des produits pour les ajouter.</div>
          </div>

          <div class="cart-summary">
            <div class="summary-row">
              <span>Sous-total :</span>
              <span id="pos-subtotal" style="font-weight: 600;">0 FCFA</span>
            </div>

            <!-- Configuration de remise -->
            <div style="display: flex; gap: 8px; margin: 4px 0;">
              <select id="pos-discount-type" class="form-input" style="width: 100px; padding: 6px 8px; font-size: 12px;" aria-label="Type de remise">
                <option value="">Pas de remise</option>
                <option value="PERCENTAGE">% Remise</option>
                <option value="FIXED">Valeur fixe</option>
              </select>
              <input type="number" id="pos-discount-value" class="form-input" style="flex: 1; padding: 6px 8px; font-size: 12px; display: none;" min="0" placeholder="Valeur..." aria-label="Valeur de la remise">
            </div>

            <div class="summary-row" id="discount-display" style="display: none; color: var(--error);">
              <span>Remise appliquée :</span>
              <span id="pos-discount-amount">0 FCFA</span>
            </div>

            <div class="summary-row total">
              <span>TOTAL À PAYER :</span>
              <span id="pos-total">0 FCFA</span>
            </div>

            <!-- Mode de paiement -->
            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <button id="pay-cash-btn" class="btn btn-primary" style="flex: 1; padding: 8px; font-size: 12px; background-color: var(--accent-color);">Especes (F8)</button>
              <button id="pay-momo-btn" class="btn btn-secondary" style="flex: 1; padding: 8px; font-size: 12px;">Mobile Money (F7)</button>
            </div>

            <!-- Détails de paiement complémentaires -->
            <div id="payment-extra-details" style="margin-top: 12px;">
              <!-- Injecté selon mode -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 12px;">Montant reçu en espèces (FCFA)</label>
                <input type="number" id="cash-received" class="form-input" style="font-size: 14px; font-weight: bold;" min="0" placeholder="0">
                <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 6px; color: var(--success);">
                  <span>Monnaie rendue :</span>
                  <span id="cash-change">0 FCFA</span>
                </div>
              </div>
            </div>

            <button id="btn-validate-sale" class="btn btn-primary" style="width: 100%; margin-top: 12px; padding: 12px; font-size: 15px; font-weight: 700; background-color: var(--success); color: var(--accent-contrast);">
              VALIDER LA VENTE (F12)
            </button>
          </div>
        </div>

        <!-- Modale de succès / Impression ticket -->
        <div id="pos-modal-container"></div>
      </div>
    `;
  }

  async afterRender() {
    
    document.getElementById('current-view-title').textContent = 'Point de Vente (POS)';

    // Attacher écouteur claviers
    window.addEventListener('keydown', this.boundKeydown);

    // Initialiser les clics
    document.getElementById('pos-search-input').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.renderProducts();
    });

    document.getElementById('btn-clear-cart').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cart = [];
      localStorage.removeItem('pos_cart');
      this.updateCartUI();
    });

    // Mobile: toggle cart collapse on header click
    const cartHeader = document.querySelector('.cart-header');
    const posCart = document.querySelector('.pos-cart');
    if (cartHeader && posCart) {
      cartHeader.addEventListener('click', () => {
        if (window.innerWidth <= 767) {
          posCart.classList.toggle('collapsed');
        }
      });
    }

    // Remise change
    const discTypeSelect = document.getElementById('pos-discount-type');
    const discValInput = document.getElementById('pos-discount-value');
    discTypeSelect.addEventListener('change', (e) => {
      this.discountType = e.target.value || null;
      if (this.discountType) {
        discValInput.style.display = 'block';
        discValInput.value = '';
      } else {
        discValInput.style.display = 'none';
        this.discountValue = 0;
      }
      this.calculateTotals();
    });

    discValInput.addEventListener('input', (e) => {
      this.discountValue = Number(e.target.value) || 0;
      this.calculateTotals();
    });

    // Boutons paiement
    document.getElementById('pay-cash-btn').addEventListener('click', () => this.selectPaymentMethod('CASH'));
    document.getElementById('pay-momo-btn').addEventListener('click', () => this.selectPaymentMethod('MOBILE_MONEY'));

    // Valider vente
    document.getElementById('btn-validate-sale').addEventListener('click', () => this.validateTransaction());

    // Charger les catégories & produits
    
    await this.loadPOSData();
    
  }

  destroy() {
    window.removeEventListener('keydown', this.boundKeydown);
  }

  handleShortcuts(e) {
    if (e.key === 'F10') {
      e.preventDefault();
      document.getElementById('pos-search-input').focus();
    } else if (e.key === 'F9') {
      e.preventDefault();
      const select = document.getElementById('pos-discount-type');
      select.focus();
    } else if (e.key === 'F8') {
      e.preventDefault();
      this.selectPaymentMethod('CASH');
    } else if (e.key === 'F7') {
      e.preventDefault();
      this.selectPaymentMethod('MOBILE_MONEY');
    } else if (e.key === 'F12') {
      e.preventDefault();
      this.validateTransaction();
    }
  }

  selectPaymentMethod(method) {
    this.paymentMethod = method;
    const cashBtn = document.getElementById('pay-cash-btn');
    const momoBtn = document.getElementById('pay-momo-btn');
    const extraContainer = document.getElementById('payment-extra-details');

    if (method === 'CASH') {
      cashBtn.className = 'btn btn-primary';
      cashBtn.style.backgroundColor = 'var(--accent-color)';
      momoBtn.className = 'btn btn-secondary';
      momoBtn.style.backgroundColor = '';

      extraContainer.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" for="cash-received" style="font-size: 12px;">Montant reçu en espèces (FCFA)</label>
          <input type="number" id="cash-received" class="form-input" style="font-size: 14px; font-weight: bold;" min="0" placeholder="0">
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 6px; color: var(--success);">
            <span>Monnaie rendue :</span>
            <span id="cash-change">0 FCFA</span>
          </div>
        </div>
      `;

      document.getElementById('cash-received').addEventListener('input', (e) => {
        this.calculateChange();
      });

    } else {
      momoBtn.className = 'btn btn-primary';
      momoBtn.style.backgroundColor = 'var(--accent-color)';
      cashBtn.className = 'btn btn-secondary';
      cashBtn.style.backgroundColor = '';

      extraContainer.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 12px;">Référence de la transaction Mobile Money</label>
          <input type="text" id="momo-ref" class="form-input" placeholder="Ex: TXN1234567890" style="font-size: 13px;" required>
        </div>
      `;
    }
  }

  async loadPOSData() {
    
    const catTabs = document.getElementById('pos-cat-tabs');
    const grid = document.getElementById('pos-products-grid');

    if (!catTabs || !grid) {
      console.error('[POS-Audit] CRITICAL: DOM elements pos-cat-tabs or pos-products-grid NOT FOUND!');
      return;
    }

    
    catTabs.innerHTML = Skeletons.grid(6, 'row');
    grid.innerHTML = Skeletons.grid(12, 'card');
    

    try {
      
      this.categories = await API.categories.list();
      

      
      const res = await API.products.list({ page: 1, limit: 100 });
      this.products = res.products;
      

      catTabs.innerHTML = `
        <button class="category-tab active" data-id="">Tous</button>
      ` + this.categories.map(c => `<button class="category-tab" data-id="${escapeAttr(c.id)}">${escapeHtml(c.name)}</button>`).join('');

      catTabs.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          catTabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
          e.target.classList.add('active');
          this.selectedCategoryId = e.target.dataset.id;
          this.renderProducts();
        });
      });

      this.renderProducts();
      
    } catch (e) {
      console.error('[POS-Audit] Error in loadPOSData:', e);
      catTabs.innerHTML = '';
      grid.innerHTML = `<div class="text-center" style="color: var(--error); padding: 40px 0;">Erreur de chargement des données.</div>`;
    }
    
  }

  renderProducts() {
    const grid = document.getElementById('pos-products-grid');

    const filtered = this.products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                          (p.sku && p.sku.toLowerCase().includes(this.searchQuery.toLowerCase()));
      const matchCat = !this.selectedCategoryId || p.category_id === this.selectedCategoryId;
      return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column: span 12; text-align: center; color: var(--text-secondary); padding: 40px 0;">Aucun produit ne correspond.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const imageUrl = p.image_url ? p.image_url : 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\' viewBox=\'0 0 150 150\'><rect width=\'150\' height=\'150\' rx=\'8\' fill=\'#f1f1ef\'/><text x=\'75\' y=\'80\' text-anchor=\'middle\' font-family=\'sans-serif\' font-size=\'14\' fill=\'#8c9196\'>Image</text></svg>');
      const isOutOfStock = p.stock_quantity <= 0;
      const productName = escapeHtml(p.name);

      return `
        <button class="product-card" data-id="${escapeAttr(p.id)}" style="${isOutOfStock ? 'opacity: 0.5;' : ''}" aria-label="Ajouter ${productName} au panier">
          <img class="product-image" src="${escapeAttr(imageUrl)}" alt="Photo de ${productName}">
          <div class="product-title">${productName}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
            <span class="product-price">${Number(p.sell_price).toLocaleString()} FCFA</span>
            <span class="product-stock ${isOutOfStock ? 'badge-danger' : ''}">${isOutOfStock ? 'Rupture' : p.stock_quantity + ' dispo'}</span>
          </div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const prod = this.products.find(p => p.id === id);
        if (prod.stock_quantity <= 0) {
          Toast.error('Produit en rupture de stock.');
          return;
        }
        this.addToCart(prod);
      });
    });
  }

  addToCart(product) {
    const existing = this.cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        Toast.error(`Impossible d'ajouter plus d'unités. Stock disponible max: ${product.stock_quantity}`);
        return;
      }
      existing.quantity++;
    } else {
      this.cart.push({
        product_id: product.id,
        name: product.name,
        sell_price: product.sell_price,
        stock_quantity: product.stock_quantity,
        quantity: 1
      });
    }
    this.saveCart();
    this.updateCartUI();
  }

  saveCart() {
    localStorage.setItem('pos_cart', JSON.stringify(this.cart));
  }

  saveCart() {
    localStorage.setItem('pos_cart', JSON.stringify(this.cart));
  }

  updateCartUI() {
    const container = document.getElementById('pos-cart-items');

    if (this.cart.length === 0) {
      container.innerHTML = `<div class="text-center" style="color: var(--text-secondary); margin: auto 0; font-size: 13px;">Panier vide. Cliquez sur des produits pour les ajouter.</div>`;
      this.calculateTotals();
      return;
    }

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item fade-in">
        <div class="cart-item-info">
          <div style="font-size: 13px; font-weight: 600; line-height: 1.3;">${escapeHtml(item.name)}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            ${Number(item.sell_price).toLocaleString()} FCFA / u
          </div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn btn-qty-minus" data-id="${escapeAttr(item.product_id)}">-</button>
          <span style="font-weight: 600; font-size: 14px; width: 20px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn btn-qty-plus" data-id="${escapeAttr(item.product_id)}">+</button>
        </div>
        <div style="font-size: 13px; font-weight: 700; width: 80px; text-align: right;">
          ${(Number(item.sell_price) * item.quantity).toLocaleString()}
        </div>
        <button class="btn-remove-item" data-id="${escapeAttr(item.product_id)}" style="color: var(--error); padding: 4px;">×</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = this.cart.find(i => i.product_id === id);
        if (item.quantity > 1) {
          item.quantity--;
          this.saveCart();
          this.updateCartUI();
        }
      });
    });

    container.querySelectorAll('.btn-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = this.cart.find(i => i.product_id === id);
        if (item.quantity < item.stock_quantity) {
          item.quantity++;
          this.saveCart();
          this.updateCartUI();
        } else {
          Toast.error('Stock maximum atteint.');
        }
      });
    });

    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.cart = this.cart.filter(i => i.product_id !== id);
        this.saveCart();
        this.updateCartUI();
      });
    });

    this.calculateTotals();
  }

  calculateTotals() {
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += Number(item.sell_price) * item.quantity;
    });

    let discountAmount = 0;
    if (this.discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * this.discountValue) / 100;
    } else if (this.discountType === 'FIXED') {
      discountAmount = this.discountValue;
    }

    const total = Math.max(0, subtotal - discountAmount);

    document.getElementById('pos-subtotal').textContent = `${subtotal.toLocaleString()} FCFA`;

    const discDisplay = document.getElementById('discount-display');
    if (discountAmount > 0) {
      discDisplay.style.display = 'flex';
      document.getElementById('pos-discount-amount').textContent = `-${discountAmount.toLocaleString()} FCFA`;
    } else {
      discDisplay.style.display = 'none';
    }

    document.getElementById('pos-total').textContent = `${total.toLocaleString()} FCFA`;

    if (this.paymentMethod === 'CASH') {
      this.calculateChange();
    }
  }

  calculateChange() {
    const receivedInput = document.getElementById('cash-received');
    if (!receivedInput) return;

    const received = Number(receivedInput.value) || 0;
    const subtotal = this.cart.reduce((sum, item) => sum + Number(item.sell_price) * item.quantity, 0);

    let discountAmount = 0;
    if (this.discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * this.discountValue) / 100;
    } else if (this.discountType === 'FIXED') {
      discountAmount = this.discountValue;
    }
    const total = Math.max(0, subtotal - discountAmount);

    const change = Math.max(0, received - total);
    document.getElementById('cash-change').textContent = `${change.toLocaleString()} FCFA`;
  }

  async validateTransaction() {
    if (this.cart.length === 0) {
      Toast.info('Le panier est vide.');
      return;
    }

    const payload = {
      items: this.cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      })),
      payment_method: this.paymentMethod
    };

    if (this.paymentMethod === 'MOBILE_MONEY') {
      const ref = document.getElementById('momo-ref').value.trim();
      if (!ref) {
        Toast.error('Veuillez renseigner la référence de transaction Mobile Money.');
        return;
      }
      payload.momo_reference = ref;
    } else {
      const received = Number(document.getElementById('cash-received').value) || 0;
      const total = Number(document.getElementById('pos-total').textContent.replace(/[^0-9]/g, ''));
      if (received < total) {
        Toast.error('Le montant reçu en espèces est insuffisant.');
        return;
      }
      payload.amount_received = received;
    }

    if (this.discountType && this.discountValue > 0) {
      payload.discount_type = this.discountType;
      payload.discount_value = this.discountValue;
    }

    const btn = document.getElementById('btn-validate-sale');
    try {
      await withLoading(btn, async () => {
        const res = await API.sales.create(payload);
        const sale = res.data.sale;

        this.openSuccessModal(sale);

        this.cart = [];
        localStorage.removeItem('pos_cart');
        this.updateCartUI();

        await this.loadPOSData();
      }, "Enregistrement de la vente...");
    } catch (err) {
      if (err.code === 'DAILY_LIMIT_REACHED') {
        Toast.error('La limite de 30 ventes par jour est atteinte pour\ l\'offre FREE.');
      } else {
        Toast.error(err.message);
      }
    }
  }

  openSuccessModal(sale) {
    const modalContainer = document.getElementById('pos-modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content" style="text-align: center; padding: 32px;">
          <div class="success-mark" aria-hidden="true">OK</div>
          <h2 id="pos-success-modal-title" style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Vente enregistrée !</h2>
          <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 24px;">
            La transaction <strong>${sale.transaction_number}</strong> d'un montant de <strong>${Number(sale.total_amount).toLocaleString()} FCFA</strong> a été créée.
          </p>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="btn-print-ticket" class="btn btn-primary" style="width: 100%; padding: 12px; background-color: var(--accent-color);">
              Imprimer le ticket
            </button>
            <button id="btn-close-success" class="btn btn-secondary" style="width: 100%; padding: 12px;">
              Fermer
            </button>
          </div>
        </div>
      </div>
    `;

    const closeFn = () => modalContainer.innerHTML = '';
    document.getElementById('btn-close-success').addEventListener('click', closeFn);

    setupDialog(modalContainer.querySelector('.modal-content'), { labelledbyId: 'pos-success-modal-title', closeFn });

    document.getElementById('btn-print-ticket').addEventListener('click', async () => {
      const btn = document.getElementById('btn-print-ticket');
      // Ouvrir le popup SYNCHRONOUSMENT au clic (avant tout await)
      // pour conserver le contexte user-gesture.
      const ticketWindow = window.open('', '_blank', 'width=350,height=600');
      if (!ticketWindow) {
        Toast.error('Le navigateur a bloqué la fenêtre d’impression. Autorisez les popups pour RDGESTION.');
        return;
      }
      ticketWindow.document.write('<!doctype html><html><head><title>Ticket RDGESTION</title><style>body{font-family:sans-serif;text-align:center;padding:40px;color:#888;}p{animation:pulse 1s infinite}@keyframes pulse{0%{opacity:.4}50%{opacity:1}100%{opacity:.4}}</style></head><body><p>Préparation du ticket…</p></body></html>');

      try {
        await withLoading(btn, async () => {
          const html = await API.sales.getTicketHtml(sale.id);
          ticketWindow.document.open();
          ticketWindow.document.write(html);
          ticketWindow.document.close();
        }, "Génération du ticket...");
      } catch (err) {
        ticketWindow.close();
        Toast.error(err.message);
      }
    });
  }
}
