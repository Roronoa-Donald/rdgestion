import { API } from '../api.js';
import { escapeHtml } from '../utils.js';

const SETUP_DISMISSED_KEY = 'rdg_setup_dismissed';
const SETUP_REFERRAL_SEEN_KEY = 'rdg_setup_referral_seen';
const SETUP_PRODUCT_CREATED_KEY = 'rdg_setup_product_created';

export class DashboardView {
  async render() {
    return `<div id="dashboard-container" class="fade-in"></div>`;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Vue d\'ensemble';

    try {
      const res = await API.dashboard.getStats();
      const stats = res.data;

      const dismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === 'true';
      const productDone = Number(stats.products.total) > 0 || localStorage.getItem(SETUP_PRODUCT_CREATED_KEY) === 'true';
      const referralDone = localStorage.getItem(SETUP_REFERRAL_SEEN_KEY) === 'true';
      const setupCompleted = productDone && referralDone;

      if (!dismissed && !setupCompleted) {
        this.renderOnboardingWizard(stats, productDone, referralDone);
      } else {
        this.renderStandardDashboard(stats);
      }
    } catch (error) {
      console.error('Erreur chargement statistiques dashboard :', error);
      const container = document.getElementById('dashboard-container');
      if (container) {
        container.innerHTML = `
          <div class="card text-center" style="max-width: 500px; margin: 40px auto; padding: 32px;">
            <h3 style="color: var(--error); margin-bottom: 8px;">Impossible de charger le tableau de bord</h3>
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">Vérifiez votre connexion internet ou le statut de la base de données.</p>
            <button id="btn-retry-dash" class="btn btn-primary btn-sm">Réessayer</button>
          </div>
        `;
        document.getElementById('btn-retry-dash')?.addEventListener('click', () => this.afterRender());
      }
    }
  }

  renderOnboardingWizard(stats, productDone, referralDone) {
    const container = document.getElementById('dashboard-container');
    const completedSteps = 1 + (productDone ? 1 : 0) + (referralDone ? 1 : 0);
    const progressPct = Math.round((completedSteps / 3) * 100);

    container.innerHTML = `
      <div class="onboarding-wizard">
        <header class="wizard-header">
          <span class="wizard-eyebrow">Démarrage rapide</span>
          <h1>Bienvenue sur votre espace de vente</h1>
          <p>Configurons ensemble les éléments clés pour commencer à encaisser vos clients.</p>
        </header>

        <section class="wizard-progress-section" aria-label="Progression de l'onboarding">
          <div class="wizard-progress-text">
            <span>Étapes d'activation complétées</span>
            <strong>${completedSteps} sur 3 (${progressPct}%)</strong>
          </div>
          <div class="wizard-progress-track">
            <div class="wizard-progress-bar" style="width: ${progressPct}%;"></div>
          </div>
        </section>

        <div class="wizard-steps">
          <!-- Étape 1 : Catégories -->
          <article class="wizard-step is-completed">
            <div class="step-icon" aria-hidden="true">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div class="step-content">
              <h3>1. Catégories initiales configurées</h3>
              <p>Votre catalogue possède maintenant ses familles de produits de départ.</p>
            </div>
            <span class="step-status">Terminé</span>
          </article>

          <!-- Étape 2 : Premier produit -->
          <article class="wizard-step ${productDone ? 'is-completed' : 'is-active'}">
            <div class="step-icon" aria-hidden="true">
              ${productDone ? `
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
              ` : `
                <span>02</span>
              `}
            </div>
            <div class="step-content">
              <h3>2. Enregistrer un premier produit</h3>
              <p>Ajoutez un produit (nom, prix d'achat/vente, stock) pour activer le Point de Vente (POS).</p>
              ${!productDone ? `
                <div class="step-actions">
                  <a href="#/products?new=1&fromSetup=1" class="btn btn-primary btn-sm">Ajouter mon premier produit</a>
                </div>
              ` : ''}
            </div>
            <span class="step-status">${productDone ? 'Terminé' : 'En cours'}</span>
          </article>

          <!-- Étape 3 : Code de parrainage -->
          <article class="wizard-step ${referralDone ? 'is-completed' : (productDone ? 'is-active' : 'is-locked')}">
            <div class="step-icon" aria-hidden="true">
              ${referralDone ? `
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
              ` : (productDone ? `
                <span>03</span>
              ` : `
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0110 0v4"></path>
                </svg>
              `)}
            </div>
            <div class="step-content">
              <h3>3. Découvrir votre code de parrainage</h3>
              <p>Important : Partagez votre code parrainage unique pour parrainer vos confrères et gagner des mois d'accès PRO gratuits.</p>
              ${(productDone && !referralDone) ? `
                <div class="step-actions">
                  <a href="#/settings?tab=referrals&fromSetup=1" class="btn btn-primary btn-sm">Consulter mon code</a>
                </div>
              ` : ''}
            </div>
            <span class="step-status">${referralDone ? 'Terminé' : (productDone ? 'À faire' : 'Verrouillé')}</span>
          </article>
        </div>

        <footer class="wizard-footer">
          <span style="font-size: 13px; color: var(--text-muted);">Vous pourrez toujours effectuer ces configurations plus tard.</span>
          <button id="skip-wizard-btn" class="btn btn-secondary btn-sm">Passer l'introduction</button>
        </footer>
      </div>
    `;

    document.getElementById('skip-wizard-btn').addEventListener('click', () => {
      const confirmed = confirm(
        "Passer l'accompagnement de démarrage ?\n\nVotre tableau de bord s'affichera vide, mais vous pourrez toujours créer des produits et consulter le parrainage plus tard."
      );
      if (confirmed) {
        localStorage.setItem(SETUP_DISMISSED_KEY, 'true');
        this.renderStandardDashboard(stats);
      }
    });
  }

  renderStandardDashboard(stats) {
    const currency = 'FCFA';
    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
      <div class="dashboard-page">
        <section id="dashboard-stock-alert" class="notice notice-warning" style="display: none;">
          <div>
            <strong>Stock à surveiller</strong>
            <p id="dashboard-stock-alert-text"></p>
          </div>
          <a href="#/products" class="btn btn-secondary btn-sm">Gérer le stock</a>
        </section>

        <section class="metric-grid" aria-label="Indicateurs du jour">
          <article class="metric-card">
            <span class="metric-label">Chiffre d'affaires aujourd'hui</span>
            <strong id="dash-revenue" class="metric-value">0 ${currency}</strong>
            <span id="dash-trend" class="metric-note"></span>
          </article>

          <article class="metric-card">
            <span class="metric-label">Bénéfice estimé</span>
            <strong id="dash-profit" class="metric-value">0 ${currency}</strong>
            <span class="metric-note">Marge nette journalière</span>
          </article>

          <article class="metric-card">
            <span class="metric-label">Ventes du jour</span>
            <strong id="dash-sales" class="metric-value">0</strong>
            <div id="limit-container" class="quota-meter" style="display: none;">
              <div class="quota-label">
                <span>Plan FREE</span>
                <span id="limit-text">0 / 30</span>
              </div>
              <div class="quota-track">
                <div id="limit-bar" class="quota-bar"></div>
              </div>
            </div>
          </article>

          <article class="metric-card">
            <span class="metric-label">Produits actifs</span>
            <strong id="dash-products" class="metric-value">0</strong>
            <span class="metric-note">Catalogue disponible à la vente</span>
          </article>
        </section>

        <section class="dashboard-grid">
          <article class="card dashboard-panel">
            <div class="panel-heading">
              <div>
                <h3>Produits les plus vendus</h3>
                <p>Classement du mois en cours.</p>
              </div>
            </div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th style="text-align: center;">Quantité vendue</th>
                    <th style="text-align: right;">Chiffre d'affaires</th>
                  </tr>
                </thead>
                <tbody id="top-products-body">
                  <tr>
                    <td colspan="3">
                      <div class="empty-state compact">
                        <strong>Aucune vente pour le moment</strong>
                        <span>Les meilleurs produits apparaîtront après vos premières ventes.</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="card dashboard-panel">
            <div class="panel-heading">
              <div>
                <h3>Modes de paiement</h3>
                <p>Répartition du mois en cours.</p>
              </div>
            </div>
            <div id="payment-methods-list" class="payment-list">
              <div class="empty-state compact">
                <strong>Pas encore de paiement</strong>
                <span>La répartition apparaîtra après la première vente.</span>
              </div>
            </div>
          </article>
        </section>
      </div>
    `;

    document.getElementById('dash-revenue').textContent = `${Number(stats.today.revenue).toLocaleString()} ${currency}`;
    document.getElementById('dash-profit').textContent = `${Number(stats.today.profit).toLocaleString()} ${currency}`;
    document.getElementById('dash-sales').textContent = stats.today.sale_count;
    document.getElementById('dash-products').textContent = stats.products.total;

    this.renderRevenueTrend(stats.today.revenue_trend_percent);
    this.renderDailyLimit(stats.today);
    this.renderStockAlert(stats.products.low_stock);
    this.renderTopProducts(stats.top_products, currency);
    this.renderPaymentMethods(stats.payment_methods, currency);
  }

  renderRevenueTrend(trendVal) {
    const trendEl = document.getElementById('dash-trend');
    if (!trendEl) return;
    if (trendVal > 0) {
      trendEl.textContent = `+${trendVal}% par rapport à hier`;
      trendEl.style.color = 'var(--success)';
    } else if (trendVal < 0) {
      trendEl.textContent = `${trendVal}% par rapport à hier`;
      trendEl.style.color = 'var(--error)';
    } else {
      trendEl.textContent = 'Stable par rapport à hier';
      trendEl.style.color = 'var(--text-secondary)';
    }
  }

  renderDailyLimit(today) {
    if (today.daily_limit_max === null) return;

    const limitContainer = document.getElementById('limit-container');
    if (limitContainer) limitContainer.style.display = 'block';
    const limitText = document.getElementById('limit-text');
    if (limitText) limitText.textContent = `${today.daily_limit_count} / ${today.daily_limit_max}`;
    
    const pct = Math.min(100, (today.daily_limit_count / today.daily_limit_max) * 100);
    const bar = document.getElementById('limit-bar');
    if (bar) {
      bar.style.width = `${pct}%`;
      if (pct >= 85) {
        bar.style.backgroundColor = 'var(--error)';
      } else if (pct >= 60) {
        bar.style.backgroundColor = 'var(--warning)';
      }
    }
  }

  renderStockAlert(lowStockCount) {
    if (lowStockCount <= 0) return;

    const stockAlert = document.getElementById('dashboard-stock-alert');
    if (stockAlert) stockAlert.style.display = 'flex';
    const alertText = document.getElementById('dashboard-stock-alert-text');
    if (alertText) alertText.textContent = `${lowStockCount} produit(s) sont en stock faible ou en rupture.`;
  }

  renderTopProducts(products, currency) {
    const topBody = document.getElementById('top-products-body');
    if (!topBody || !products || products.length === 0) return;

    topBody.innerHTML = products.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.product_name)}</strong></td>
        <td style="text-align: center;"><span class="badge" style="background: var(--bg-tertiary);">${p.total_quantity}</span></td>
        <td style="text-align: right; font-weight: 600;">${Number(p.total_revenue).toLocaleString()} ${currency}</td>
      </tr>
    `).join('');
  }

  renderPaymentMethods(methods, currency) {
    const payList = document.getElementById('payment-methods-list');
    if (!payList || !methods || methods.length === 0) return;

    const totalPay = methods.reduce((sum, item) => sum + Number(item.total_amount), 0);
    payList.innerHTML = methods.map(p => {
      const pct = totalPay > 0 ? Math.round((Number(p.total_amount) / totalPay) * 100) : 0;
      const methodLabel = p.payment_method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Espèces';

      return `
        <div class="payment-row" style="margin-bottom: 12px;">
          <div class="payment-row-head" style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
            <strong>${methodLabel}</strong>
            <span style="color: var(--text-secondary);">${Number(p.total_amount).toLocaleString()} ${currency} (${pct}%)</span>
          </div>
          <div class="payment-track" style="height: 6px; background: var(--bg-tertiary); border-radius: 99px; overflow: hidden;">
            <div class="payment-bar" style="height: 100%; background: var(--accent-color); width: ${pct}%; border-radius: 99px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}
