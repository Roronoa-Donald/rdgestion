import { API } from '../api.js';
import { escapeHtml, escapeAttr } from '../utils.js';
import { Toast, withLoading, Skeletons, confirmModal, alertModal } from '../utils/ui.js';
import { setupTablist, setupDialog } from '../utils/aria.js';

export class SettingsView {
  constructor(queryParams = {}) {
    const allowedTabs = ['profile', 'vendors', 'referrals', 'subscription'];
    this.queryParams = queryParams;
    this.activeTab = allowedTabs.includes(queryParams.tab) ? queryParams.tab : 'profile';
    this.vendors = [];
    this.settings = {};
    this.profile = {};
    this.referralInfo = {};
    this.subscription = {}; // { tier, status, end_date, daily_limit_count, daily_limit_max }
  }

  async render() {
    return `
      <div class="fade-in">
        <!-- Menu d'onglets (Tabs) -->
        <div id="settings-tablist" style="display: flex; gap: 12px; border-bottom: 1px solid var(--border-color); margin-bottom: 24px; overflow-x: auto; padding-bottom: 8px;">
          <button class="btn btn-secondary tab-link" data-tab="profile" style="border: none; border-radius: 0; background: none; border-bottom: 2px solid transparent; padding: 8px 16px; font-weight: 600;">Boutique & ticket</button>
          <button class="btn btn-secondary tab-link" data-tab="vendors" style="border: none; border-radius: 0; background: none; border-bottom: 2px solid transparent; padding: 8px 16px; font-weight: 600;">Comptes vendeurs</button>
          <button class="btn btn-secondary tab-link" data-tab="referrals" style="border: none; border-radius: 0; background: none; border-bottom: 2px solid transparent; padding: 8px 16px; font-weight: 600;">Parrainage & code</button>
          <button class="btn btn-secondary tab-link" data-tab="subscription" style="border: none; border-radius: 0; background: none; border-bottom: 2px solid transparent; padding: 8px 16px; font-weight: 600;"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align: -2px; margin-right: 4px;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Abonnement PRO</button>
        </div>

        <div id="settings-tab-content">
          <!-- Injecté dynamiquement par JavaScript -->
        </div>

        <!-- Modale de création vendeur -->
        <div id="settings-modal-container"></div>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Paramètres';

    // Détecter le retour de paiement FedaPay (?payment=done)
    if (this.queryParams.payment === 'done') {
      alertModal(
        'Votre paiement est en cours de traitement. Votre abonnement PRO sera activé dans quelques instants. Si votre compte n\'est pas PRO sous 5 minutes, contactez le support.',
        { title: 'Paiement en cours' }
      );
      // Nettoyer l'URL pour éviter d'afficher le modal à chaque rechargement
      const cleanHash = window.location.hash.split('?')[0];
      window.history.replaceState(null, '', cleanHash);
      // Forcer l'onglet abonnement pour voir le statut
      this.activeTab = 'subscription';
    }

    // Attacher onglets avec sémantique ARIA tablist/tab/tabpanel + navigation flèches
    const tablistEl = document.getElementById('settings-tablist');
    setupTablist(tablistEl, () => this.activeTab, (id) => {
      this.activeTab = id;
      this.switchTab();
    });
    const syncTabStyles = () => {
      tablistEl.querySelectorAll('.tab-link').forEach(l => {
        const isActive = l.dataset.tab === this.activeTab;
        l.classList.toggle('active', isActive);
        l.style.borderBottomColor = isActive ? 'var(--accent-color)' : 'transparent';
        l.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
      });
    };
    tablistEl.querySelectorAll('.tab-link').forEach(link => {
      link.addEventListener('click', () => {
        syncTabStyles();
      });
    });

    // Définir la couleur de l'onglet actif initial
    syncTabStyles();

    // Charger les paramètres initiaux
    try {
      this.settings = (await API.settings.get()).data;
      this.profile = (await API.settings.getProfile()).data;
      this.subscription = (await API.admin.getSubscription()).data || {};
    } catch (e) {
      console.error(e);
    }

    await this.switchTab();
    syncTabStyles();
  }

  /**
   * Commute l'affichage de l'onglet actif.
   */
  async switchTab() {
    const container = document.getElementById('settings-tab-content');
    
    if (this.activeTab === 'profile') {
      container.innerHTML = this.renderProfileTab();
      this.bindProfileTabEvents();
    } else if (this.activeTab === 'vendors') {
      container.innerHTML = this.renderVendorsTab();
      await this.loadVendors();
      this.bindVendorsTabEvents();
    } else if (this.activeTab === 'referrals') {
      localStorage.setItem('rdg_setup_referral_seen', 'true');
      container.innerHTML = this.renderReferralsTab();
      await this.loadReferrals();
      this.bindReferralsTabEvents();
    } else if (this.activeTab === 'subscription') {
      container.innerHTML = this.renderSubscriptionTab();
      this.bindSubscriptionTabEvents();
    }
  }

  // ==========================================
  // OBLIGATION 1 : PROFIL & PARAMÈTRES BOUTIQUE & TICKET
  // ==========================================

  renderProfileTab() {
    const s = this.settings;
    const p = this.profile;
    const profile = {
      name: escapeAttr(p.name || ''),
      owner_name: escapeAttr(p.owner_name || ''),
      phone: escapeAttr(p.phone || ''),
      email: escapeAttr(p.email || ''),
      address: escapeAttr(p.address || ''),
      city: escapeAttr(p.city || ''),
      country: escapeAttr(p.country || ''),
      currency: escapeAttr(p.currency || 'FCFA'),
      tax_number: escapeAttr(p.tax_number || ''),
      footer: escapeAttr(s.ticket_footer_message || '')
    };

    return `
      <div class="fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        
        <!-- Formulaire Profil Boutique -->
        <div class="card" style="margin-bottom: 0;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">Fiche d'Identité du Commerce</h3>
          <form id="profile-form">
            <div class="form-group">
              <label class="form-label">Nom de la boutique</label>
              <input type="text" id="prof-name" class="form-input" value="${profile.name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nom du propriétaire / gérant</label>
              <input type="text" id="prof-owner" class="form-input" value="${profile.owner_name}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Numéro de téléphone</label>
              <input type="text" id="prof-phone" class="form-input" value="${profile.phone}" required disabled>
              <small style="color: var(--text-muted);">L'identifiant téléphonique ne peut pas être modifié.</small>
            </div>
            <div class="form-group">
              <label class="form-label">Adresse email</label>
              <input type="email" id="prof-email" class="form-input" value="${profile.email}">
            </div>
            <div class="form-group">
              <label class="form-label">Adresse géographique</label>
              <input type="text" id="prof-address" class="form-input" value="${profile.address}">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Ville</label>
                <input type="text" id="prof-city" class="form-input" value="${profile.city}">
              </div>
              <div class="form-group">
                <label class="form-label">Pays</label>
                <input type="text" id="prof-country" class="form-input" value="${profile.country}">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Devise monétaire</label>
                <input type="text" id="prof-currency" class="form-input" value="${profile.currency}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Numéro fiscal (NIF / RC)</label>
                <input type="text" id="prof-tax" class="form-input" value="${profile.tax_number}" placeholder="Ex: NIF 100029323">
              </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Enregistrer le profil</button>
          </form>
        </div>

        <!-- Paramètres techniques & Tickets -->
        <div class="card" style="margin-bottom: 0; display: flex; flex-direction: column; gap: 24px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Configuration generale</h3>
            <form id="settings-general-form">
              <div class="form-group">
                <label class="form-label">Seuil d'alerte de stock par défaut (Boutique)</label>
                <input type="number" id="set-threshold" class="form-input" value="${s.global_stock_threshold}" min="1" required>
              </div>
              <div class="form-group">
                <label class="form-label">Remise maximale autorisée aux vendeurs (%)</label>
                <input type="number" id="set-discount" class="form-input" value="${s.max_seller_discount_percentage}" min="0" max="100" required>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">Enregistrer les limites</button>
            </form>
          </div>

          <div style="border-top: 1px solid var(--border-color); padding-top: 20px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Configuration impression ticket</h3>
            <form id="settings-ticket-form">
              <div class="form-group">
                <label class="form-label">Format de largeur du ticket</label>
                <select id="set-width" class="form-input">
                  <option value="58mm" ${s.ticket_width === '58mm' ? 'selected' : ''}>58 mm (Standard étroit)</option>
                  <option value="80mm" ${s.ticket_width === '80mm' ? 'selected' : ''}>80 mm (Grand format classique)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Message de pied de page (Footer)</label>
                <input type="text" id="set-footer" class="form-input" value="${profile.footer}" maxLength="200">
              </div>
              <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                  <input type="checkbox" id="set-show-logo" ${s.ticket_show_logo ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--accent-color);">
                  Afficher le logo du commerce sur le ticket
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                  <input type="checkbox" id="set-show-slogan" ${s.ticket_show_slogan ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--accent-color);">
                  Afficher le slogan du commerce sur le ticket
                </label>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">Enregistrer le layout ticket</button>
            </form>
          </div>
        </div>

      </div>
    `;
  }

  bindProfileTabEvents() {
    // Submit profil
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('prof-name').value.trim(),
        owner_name: document.getElementById('prof-owner').value.trim(),
        email: document.getElementById('prof-email').value.trim() || null,
        address: document.getElementById('prof-address').value.trim() || null,
        city: document.getElementById('prof-city').value.trim() || null,
        country: document.getElementById('prof-country').value.trim() || null,
        currency: document.getElementById('prof-currency').value.trim(),
        tax_number: document.getElementById('prof-tax').value.trim() || null
      };
      try {
        this.profile = (await API.settings.updateProfile(payload)).data;
        alertModal('Profil de la boutique mis à jour avec succès.', { title: 'Profil' });
      } catch (err) {
        alertModal(err.message, { title: 'Erreur' });
      }
    });

    // Submit general
    document.getElementById('settings-general-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        global_stock_threshold: parseInt(document.getElementById('set-threshold').value, 10),
        max_seller_discount_percentage: Number(document.getElementById('set-discount').value)
      };
      try {
        this.settings = (await API.settings.update(payload)).data;
        alertModal('Limites de configuration enregistrées avec succès.', { title: 'Configuration' });
      } catch (err) {
        alertModal(err.message, { title: 'Erreur' });
      }
    });

    // Submit ticket
    document.getElementById('settings-ticket-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        ticket_width: document.getElementById('set-width').value,
        ticket_footer_message: document.getElementById('set-footer').value.trim(),
        ticket_show_logo: document.getElementById('set-show-logo').checked,
        ticket_show_slogan: document.getElementById('set-show-slogan').checked
      };
      try {
        this.settings = (await API.settings.update(payload)).data;
        alertModal('Configuration du ticket enregistrée avec succès.', { title: 'Ticket' });
      } catch (err) {
        alertModal(err.message, { title: 'Erreur' });
      }
    });
  }

  // ==========================================
  // OBLIGATION 2 : GESTION DES VENDEURS
  // ==========================================

  renderVendorsTab() {
    return `
      <div class="card fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 600;">Liste des Comptes Vendeurs</h3>
            <p style="color: var(--text-secondary); font-size: 13px;">Comptes restreints uniquement utilisables sur le module POS caisse.</p>
          </div>
          <button id="btn-create-vendor" class="btn btn-primary">Creer un compte vendeur</button>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Identifiant unique de connexion</th>
                <th>Nom d'affichage</th>
                <th>Créé le</th>
                <th>Dernière connexion</th>
                <th style="text-align: center;">Statut</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="vendors-table-body">
              <tr>
                <td colspan="6" class="text-center">Chargement des comptes vendeurs...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async loadVendors() {
    const tbody = document.getElementById('vendors-table-body');
    try {
      const res = await API.settings.listVendors();
      this.vendors = res.data;

      if (this.vendors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-secondary);">Aucun vendeur créé. Créez-en un pour permettre à vos collaborateurs d'encaisser les ventes.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.vendors.map(v => {
        const created = new Date(v.created_at).toLocaleDateString('fr-FR');
        const login = v.last_login_at ? new Date(v.last_login_at).toLocaleString('fr-FR') : 'Jamais connecté';
        const username = escapeHtml(v.username);
        const displayName = escapeHtml(v.display_name || '-');
        
        const badgeClass = v.is_active ? 'badge-success' : 'badge-danger';
        const badgeLabel = v.is_active ? 'Actif' : 'Désactivé';
        const actionLabel = v.is_active ? 'Suspendre' : 'Activer';

        return `
          <tr>
            <td data-label="Identifiant unique de connexion"><code>${username}</code></td>
            <td data-label="Nom d'affichage"><strong>${displayName}</strong></td>
            <td data-label="Créé le">${created}</td>
            <td data-label="Dernière connexion"><small>${login}</small></td>
            <td data-label="Statut" style="text-align: center;">
              <span class="badge ${badgeClass}">${badgeLabel}</span>
            </td>
            <td data-label="Action" style="text-align: right;">
              <button class="btn btn-secondary btn-toggle-vendor" data-id="${escapeAttr(v.id)}" data-active="${v.is_active}" style="padding: 4px 8px; font-size: 11px;">
                ${actionLabel}
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-toggle-vendor').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.dataset.id;
          const currentActive = btn.dataset.active === 'true';
          const nextActive = !currentActive;
          
          const confirmed = await confirmModal(`Voulez-vous vraiment ${nextActive ? 'activer' : 'désactiver'} ce compte vendeur ?`, { title: nextActive ? 'Activer le vendeur' : 'Désactiver le vendeur', confirmText: nextActive ? 'Activer' : 'Désactiver', danger: !nextActive });
          if (confirmed) {
            try {
              await API.settings.toggleVendor(id, nextActive);
              await this.loadVendors();
            } catch (err) {
              alertModal(err.message, { title: 'Erreur' });
            }
          }
        });
      });

    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--error);">Une erreur est survenue lors du chargement des vendeurs.</td></tr>`;
    }
  }

  bindVendorsTabEvents() {
    document.getElementById('btn-create-vendor').addEventListener('click', () => {
      const container = document.getElementById('settings-modal-container');
      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="vendor-modal-title" style="font-size: 16px; font-weight: 600;">Nouveau vendeur</h3>
              <button id="modal-close" style="font-size: 20px;" aria-label="Fermer la fenêtre">×</button>
            </div>
            
            <form id="create-vendor-form">
              <div class="modal-body">
                <div id="vendor-error" class="badge badge-danger" style="display: none; width: 100%; padding: 10px; border-radius: var(--radius); margin-bottom: 16px;"></div>

                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">
                  L'identifiant vendeur (de type <code>vendeur.boutique-nnn</code>) sera généré aléatoirement et de façon unique par le système.
                </p>

                <div class="form-group">
                  <label class="form-label">Mot de passe du vendeur (8 car. min, 1 maj, 1 chiffre)</label>
                  <input type="password" id="v-pass" class="form-input" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Confirmer le mot de passe</label>
                  <input type="password" id="v-confirm" class="form-input" required>
                </div>
              </div>
              
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary modal-close-btn">Annuler</button>
                <button type="submit" class="btn btn-primary">Créer le compte</button>
              </div>
            </form>
          </div>
        </div>
      `;

      const closeFn = () => container.innerHTML = '';
      document.getElementById('modal-close').addEventListener('click', closeFn);
      container.querySelector('.modal-close-btn').addEventListener('click', closeFn);

      setupDialog(container.querySelector('.modal-content'), { labelledbyId: 'vendor-modal-title', closeFn });

      const form = document.getElementById('create-vendor-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('vendor-error');
        errEl.style.display = 'none';

        const password = document.getElementById('v-pass').value;
        const password_confirm = document.getElementById('v-confirm').value;

        if (password !== password_confirm) {
          errEl.textContent = 'Les mots de passe ne correspondent pas.';
          errEl.style.display = 'block';
          return;
        }

        if (password.length < 8) {
          errEl.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
          errEl.style.display = 'block';
          return;
        }

        const hasUppercase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        if (!hasUppercase || !hasNumber) {
          errEl.textContent = 'Le mot de passe doit contenir au moins une lettre majuscule et un chiffre.';
          errEl.style.display = 'block';
          return;
        }

        try {
          const res = await API.auth.createVendor({ password, password_confirm });
          const v = res.data.vendor;
          closeFn();
          alertModal(`Compte vendeur créé ! Identifiant : ${v.username}`, { title: 'Vendeur créé' });
          await this.loadVendors();
        } catch (err) {
          errEl.textContent = err.message || 'Erreur lors de la création.';
          errEl.style.display = 'block';
        }
      });
    });
  }

  // ==========================================
  // OBLIGATION 3 : PARRAINAGE & CODE
  // ==========================================

  renderReferralsTab() {
    const showBanner = this.queryParams.fromSetup === '1';
    return `
      <div class="fade-in" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        ${showBanner ? `
          <div class="notice notice-warning" style="grid-column: span 2; border-color: var(--border-strong); background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 0; border-radius: 6px;">
            <div>
              <strong style="color: var(--text-primary); font-size: 14px;">Étape 3 : Code de parrainage découvert !</strong>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-secondary);">Vous avez pris connaissance de votre code de parrainage. Vous pouvez maintenant terminer votre onboarding.</p>
            </div>
            <a href="#/dashboard" class="btn btn-primary btn-sm">Terminer l'onboarding</a>
          </div>
        ` : ''}
        
        <!-- Fiche code parrainage -->
        <div class="card" style="margin-bottom: 0; text-align: center; padding: 40px 24px;">
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Programme de Parrainage</h3>
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 24px; line-height: 1.4;">
            Parrainez d'autres commerçants de votre région ! S'ils s'inscrivent avec votre code et passent au plan PRO, 
            <strong>gagnez 1 mois gratuit d'abonnement PRO</strong> pour chaque tranche de 2 filleuls PRO payants.
          </p>

          <div style="background-color: var(--bg-primary); border: 2px dashed var(--border-color); padding: 16px; border-radius: var(--radius); margin-bottom: 24px; position: relative;">
            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Votre Code Unique</div>
            <h2 id="ref-code-text" style="font-size: 24px; font-weight: 800; letter-spacing: 1px; color: var(--accent-color);">RD-SYSTEM-000</h2>
            <button id="btn-copy-code" class="btn btn-secondary" style="margin-top: 10px; font-size: 12px; padding: 4px 10px;">Copier le code</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="background-color: var(--bg-tertiary); padding: 12px; border-radius: var(--radius);">
              <div style="font-size: 11px; color: var(--text-secondary);">Filleuls inscrits</div>
              <h3 id="ref-stat-total" style="font-size: 20px; font-weight: 700; margin-top: 4px;">0</h3>
            </div>
            <div style="background-color: var(--bg-tertiary); padding: 12px; border-radius: var(--radius);">
              <div style="font-size: 11px; color: var(--text-secondary);">Passés au plan PRO</div>
              <h3 id="ref-stat-pro" style="font-size: 20px; font-weight: 700; margin-top: 4px; color: var(--success);">0</h3>
            </div>
          </div>
        </div>

        <!-- Liste des Filleuls -->
        <div class="card" style="margin-bottom: 0;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Vos commerces affiliés</h3>
          <div class="table-responsive" style="max-height: 380px; overflow-y: auto;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>Commerce</th>
                  <th>Date d'adhésion</th>
                  <th style="text-align: right;">Statut parrainage</th>
                </tr>
              </thead>
              <tbody id="referrals-table-body">
                <tr>
                  <td colspan="3" class="text-center">Chargement...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  async loadReferrals() {
    try {
      const res = await API.admin.getReferrals();
      this.referralInfo = res.data;

      // Afficher code parrainage
      document.getElementById('ref-code-text').textContent = this.referralInfo.referral_code;

      // Stats
      document.getElementById('ref-stat-total').textContent = this.referralInfo.stats.total;
      document.getElementById('ref-stat-pro').textContent = this.referralInfo.stats.completed;

      // Charger le tableau des filleuls
      const tbody = document.getElementById('referrals-table-body');
      if (this.referralInfo.referrals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="color: var(--text-secondary); padding: 40px 0;">Aucun affilié pour le moment. Partagez votre code parrainage !</td></tr>`;
        return;
      }

      tbody.innerHTML = this.referralInfo.referrals.map(r => {
        const adhesion = new Date(r.created_at).toLocaleDateString('fr-FR');
        const referredName = escapeHtml(r.referred_tenant_name);
        
        let statusBadge = '<span class="badge badge-warning">FREE</span>';
        if (r.status === 'COMPLETED' || r.status === 'REWARDED') {
          statusBadge = '<span class="badge badge-success">PRO</span>';
        }

        return `
          <tr>
            <td><strong>${referredName}</strong></td>
            <td>${adhesion}</td>
            <td style="text-align: right;">${statusBadge}</td>
          </tr>
        `;
      }).join('');

    } catch (e) {
      console.error(e);
      document.getElementById('referrals-table-body').innerHTML = `<tr><td colspan="3" class="text-center" style="color: var(--error);">Une erreur est survenue lors du chargement.</td></tr>`;
    }
  }

  bindReferralsTabEvents() {
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('ref-code-text').textContent;
      navigator.clipboard.writeText(code).then(() => {
        Toast.success('Code parrainage copié !');
      }).catch(err => {
        console.error(err);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Onglet Abonnement PRO
  // ═══════════════════════════════════════════════════════════

  renderSubscriptionTab() {
    const sub = this.subscription;
    const tier = sub.tier || 'FREE';
    const status = sub.status || 'active';
    const endDate = sub.end_date
      ? new Date(sub.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';
    const dailyUsed = sub.daily_limit_count || 0;
    const dailyMax = sub.daily_limit_max || 30;
    const isPro = tier === 'PRO_MONTHLY' || tier === 'PRO_LIFETIME';

    const proBadge = isPro
      ? `<span style="background: var(--accent); color: var(--accent-contrast); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 4px;"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> PRO ${tier === 'PRO_LIFETIME' ? 'À VIE' : 'MENSUEL'}</span>`
      : `<span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">FREE</span>`;

    const pricingCards = isPro ? '' : `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px;">
        <div style="border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; text-align: center;">
          <h4 style="margin: 0 0 8px;">PRO Mensuel</h4>
          <p style="font-size: 2rem; font-weight: 700; margin: 8px 0;">5 000 <span style="font-size: 1rem; font-weight: 400;">FCFA/mois</span></p>
          <ul style="text-align: left; margin: 16px 0; padding-left: 0; color: var(--text-secondary); font-size: 0.9rem; list-style: none;">
            <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M5 13l4 4L19 7"/></svg> Ventes illimitées</li>
            <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M5 13l4 4L19 7"/></svg> Tickets personnalisés (logo, slogan)</li>
            <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M5 13l4 4L19 7"/></svg> Exports Excel & PDF</li>
            <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M5 13l4 4L19 7"/></svg> Catégories personnalisées</li>
          </ul>
          <button id="btn-upgrade-monthly" class="btn btn-primary" style="width: 100%;"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align: -3px; margin-right: 6px;"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> Payer 5 000 FCFA / mois</button>
        </div>
        <div style="border: 2px solid var(--accent); border-radius: 12px; padding: 24px; text-align: center; position: relative;">
          <span style="position: absolute; top: -12px; right: 20px; background: var(--accent); color: var(--accent-contrast); padding: 2px 10px; border-radius: 10px; font-size: 0.75rem;">ÉCONOMIE</span>
          <h4 style="margin: 0 0 8px;">PRO À Vie</h4>
          <p style="font-size: 2rem; font-weight: 700; margin: 8px 0;">50 000 <span style="font-size: 1rem; font-weight: 400;">FCFA</span></p>
          <p style="color: var(--accent); font-size: 0.85rem; margin: 4px 0;">Paiement unique • À vie</p>
          <ul style="text-align: left; margin: 16px 0; padding-left: 0; color: var(--text-secondary); font-size: 0.9rem; list-style: none;">
            <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M5 13l4 4L19 7"/></svg> Tout PRO Mensuel</li>
            <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M5 13l4 4L19 7"/></svg> Pas de renouvellement</li>
            <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="16" height="16" fill="none" stroke="var(--success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M5 13l4 4L19 7"/></svg> Économisez 10 000 FCFA/an</li>
          </ul>
          <button id="btn-upgrade-lifetime" class="btn btn-primary" style="width: 100%; background: var(--accent);"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align: -3px; margin-right: 6px;"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> Payer 50 000 FCFA</button>
        </div>
      </div>
    `;

    return `
      <div class="fade-in">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h3 style="margin: 0;">Votre Abonnement</h3>
            <p style="margin: 4px 0; color: var(--text-secondary);">Gérez votre plan et passez à PRO pour débloquer toutes les fonctionnalités.</p>
          </div>
          ${proBadge}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div style="background: var(--bg-secondary); border-radius: 10px; padding: 16px;">
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">Plan actuel</p>
            <p style="margin: 4px 0; font-size: 1.2rem; font-weight: 700;">${tier === 'FREE' ? 'Gratuit (FREE)' : tier}</p>
          </div>
          <div style="background: var(--bg-secondary); border-radius: 10px; padding: 16px;">
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">Statut</p>
            <p style="margin: 4px 0; font-size: 1.2rem; font-weight: 700; color: ${status === 'active' ? 'var(--success)' : 'var(--warning)'}; display: flex; align-items: center; gap: 6px;">${status === 'active' ? '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg> Actif' : '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg> ' + status}</p>
          </div>
          <div style="background: var(--bg-secondary); border-radius: 10px; padding: 16px;">
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">${isPro ? 'Expire le' : 'Ventes du jour'}</p>
            <p style="margin: 4px 0; font-size: 1.2rem; font-weight: 700;">${isPro ? endDate : `${dailyUsed} / ${dailyMax}`}</p>
            ${!isPro && dailyUsed >= 25 ? `<p style="margin: 4px 0; color: var(--warning); font-size: 0.8rem; display: flex; align-items: center; gap: 4px;"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg> Proche de la limite quotidienne</p>` : ''}
          </div>
        </div>

        ${pricingCards}

        ${isPro ? `
          <div style="margin-top: 24px; padding: 16px; background: var(--bg-secondary); border-radius: 10px; text-align: center;">
            <p style="margin: 0; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; gap: 6px;"><svg width="18" height="18" fill="none" stroke="var(--success)" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg> Vous êtes déjà <strong>PRO</strong> ! Toutes les fonctionnalités sont débloquées.</p>
            ${tier === 'PRO_MONTHLY' ? `<p style="margin: 4px 0; font-size: 0.85rem; color: var(--text-secondary);">Votre abonnement expire le ${endDate}.</p>` : ''}
          </div>
        ` : ''}

        <p style="margin-top: 24px; font-size: 0.8rem; color: var(--text-secondary); text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Paiement sécurisé via <strong>FedaPay</strong> (Mobile Money, carte bancaire).<br>
          En cas de problème, contactez le support.
        </p>
      </div>
    `;
  }

  bindSubscriptionTabEvents() {
    const monthlyBtn = document.getElementById('btn-upgrade-monthly');
    const lifetimeBtn = document.getElementById('btn-upgrade-lifetime');

    const handleUpgrade = async (amount, billingType, label) => {
      const confirmed = await confirmModal(`Confirmer le paiement de ${amount.toLocaleString()} FCFA pour l'abonnement ${label} ?`, { title: 'Paiement PRO', confirmText: 'Payer maintenant' });
      if (!confirmed) return;

      try {
        const btn = billingType === 'MONTHLY' ? monthlyBtn : lifetimeBtn;
        await withLoading(btn, async () => {
          const result = await API.payments.createIntent(amount, `Abonnement PRO ${label} — RDGESTION`, billingType);
          const checkoutUrl = result?.data?.intent?.checkout_url;
          if (checkoutUrl) {
            alertModal('Redirection vers FedaPay...', { title: 'Paiement' });
            window.location.href = checkoutUrl;
          } else {
            throw new Error('URL de paiement non reçue.');
          }
        }, 'Connexion à FedaPay...');
      } catch (e) {
        alertModal(e.message || 'Erreur lors de la création du paiement.', { title: 'Erreur' });
        console.error(e);
      }
    };

    if (monthlyBtn) {
      monthlyBtn.addEventListener('click', () => handleUpgrade(5000, 'MONTHLY', 'PRO Mensuel'));
    }
    if (lifetimeBtn) {
      lifetimeBtn.addEventListener('click', () => handleUpgrade(50000, 'LIFETIME', 'PRO À Vie'));
    }
  }
}
