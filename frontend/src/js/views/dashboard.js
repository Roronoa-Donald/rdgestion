import { API } from '../api.js';
import { escapeHtml } from '../utils.js';
import { Toast, withLoading, Skeletons } from '../utils/ui.js';

const SETUP_DISMISSED_KEY = 'rdg_setup_dismissed';
const SETUP_REFERRAL_SEEN_KEY = 'rdg_setup_referral_seen';
const SETUP_PRODUCT_CREATED_KEY = 'rdg_setup_product_created';

export class DashboardView {
  async render() {
    return `<div id="dashboard-container" class="fade-in"></div>`;
  }

  async afterRender() {
    
    document.getElementById('current-view-title').textContent = 'Vue d\'ensemble';

    const container = document.getElementById('dashboard-container');
    if (!container) {
      console.error('[DASH-Audit] CRITICAL: dashboard-container NOT FOUND!');
      return;
    }
    const containerId = 'dashboard-container';

    
    container.innerHTML = `
      <div class="dashboard-page">
        <section class="metric-grid">
          ${Skeletons.grid(4, 'card')}
        </section>
        <section class="dashboard-grid">
          <article class="card dashboard-panel">
            <div class="panel-heading">
              <div class="skeleton skeleton-text" style="width: 200px; height: 24px;"></div>
              <div class="skeleton skeleton-text" style="width: 150px; height: 14px;"></div>
            </div>
            <div class="table-responsive">
              <table class="table">${Skeletons.table(3, 5)}</table>
            </div>
          </article>
          <article class="card dashboard-panel">
            <div class="panel-heading">
              <div class="skeleton skeleton-text" style="width: 180px; height: 24px;"></div>
              <div class="skeleton skeleton-text" style="width: 120px; height: 14px;"></div>
            </div>
            <div class="payment-list">${Skeletons.grid(4, 'row')}</div>
          </article>
        </section>
      </div>
    `;
    

    const isStillActive = () => document.getElementById(containerId) === container;

    try {
      
      const res = await API.dashboard.getStats();
      if (!isStillActive()) {
        
        return;
      }
      const stats = res?.data;
      if (!stats) {
        throw new Error('Réponse du tableau de bord invalide.');
      }
      

      const dismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === 'true';
      const productDone = Number(stats.products.total) > 0 || localStorage.getItem(SETUP_PRODUCT_CREATED_KEY) === 'true';
      const referralDone = localStorage.getItem(SETUP_REFERRAL_SEEN_KEY) === 'true';
      const setupCompleted = productDone && referralDone;

      if (!dismissed && !setupCompleted) {
        
        if (isStillActive()) this.renderOnboardingWizard(stats, productDone, referralDone);
      } else {
        
        if (isStillActive()) this.renderStandardDashboard(stats);
      }
    } catch (error) {
      console.error('[DASH-Audit] Error loading stats:', error);
      if (isStillActive()) {
        container.innerHTML = `
          <div class="card text-center" style="max-width: 500px; margin: 40px auto; padding: 32px;" role="alert">
            <h3 style="color: var(--error); margin-bottom: 8px;">Impossible de charger le tableau de bord</h3>
            <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 16px;">Vérifiez votre connexion internet ou le statut de la base de données.</p>
            <button id="btn-retry-dash" class="btn btn-primary btn-sm">Réessayer</button>
          </div>
        `;
        const retryBtn = document.getElementById('btn-retry-dash');
        if (retryBtn) {
          retryBtn.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            await withLoading(btn, () => this.afterRender(), "Chargement des statistiques...");
          });
        }
      }
    }
    
  }

  renderOnboardingWizard(stats, productDone, referralDone) {
    const container = document.getElementById('dashboard-container');
    if (!container) return;
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
          <div class="wizard-progress-track" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression de configuration">
            <div class="wizard-progress-bar" style="width: ${progressPct}%;"></div>
          </div>
        </section>

        <div class="wizard-steps">
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
    this.currentPeriod = 'daily';
    this.chartData = stats.chart_data || { daily: [], weekly: [], monthly: [], yearly: [] };
    
    const container = document.getElementById('dashboard-container');
    if (!container) return;
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

        <section class="card dashboard-panel" aria-label="Évolution du chiffre d'affaires">
          <div class="panel-heading">
            <div>
              <h3>Évolution du chiffre d'affaires</h3>
              <p>Tendance sur la période sélectionnée.</p>
            </div>
            <div class="period-selector" role="group" aria-label="Sélection de la période">
              <button class="btn btn-sm btn-secondary period-btn active" data-period="daily">Jour</button>
              <button class="btn btn-sm btn-secondary period-btn" data-period="weekly">Semaine</button>
              <button class="btn btn-sm btn-secondary period-btn" data-period="monthly">Mois</button>
              <button class="btn btn-sm btn-secondary period-btn" data-period="yearly">Année</button>
            </div>
          </div>
          <div class="chart-container">
            <svg id="revenue-chart" viewBox="0 0 600 200" aria-label="Graphique d'évolution du CA" role="img">
              <title>Évolution du chiffre d'affaires</title>
              <desc>Graphique en courbe montrant l'évolution des ventes sur la période sélectionnée</desc>
              <rect class="chart-bg" x="0" y="0" width="600" height="200" fill="var(--bg-tertiary)" opacity="0.3"/>
              <g id="chart-grid" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4">
                <line x1="40" y1="20" x2="40" y2="180"/>
                <line x1="120" y1="20" x2="120" y2="180"/>
                <line x1="200" y1="20" x2="200" y2="180"/>
                <line x1="280" y1="20" x2="280" y2="180"/>
                <line x1="360" y1="20" x2="360" y2="180"/>
                <line x1="440" y1="20" x2="440" y2="180"/>
                <line x1="520" y1="20" x2="520" y2="180"/>
                <line x1="600" y1="20" x2="600" y2="180"/>
                <line x1="40" y1="40" x2="600" y2="40"/>
                <line x1="40" y1="80" x2="600" y2="80"/>
                <line x1="40" y1="120" x2="600" y2="120"/>
                <line x1="40" y1="160" x2="600" y2="160"/>
                <line x1="40" y1="180" x2="600" y2="180"/>
              </g>
              <g id="chart-area" fill="var(--success)" opacity="0.2"/>
              <polyline id="chart-line" fill="none" stroke="var(--success)" stroke-width="2.5" points=""/>
              <g id="chart-labels" font-size="9" fill="var(--text-secondary)" text-anchor="middle"/>
              <text id="chart-empty" x="320" y="100" fill="var(--text-muted)" font-size="13" text-anchor="middle">Aucune donnée disponible</text>
            </svg>
          </div>
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
                <span class="text-secondary">La répartition apparaîtra après la première vente.</span>
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
    this.renderRevenueChart(this.currentPeriod);
    this.bindPeriodSelector();
    if (stats.category_sales && stats.category_sales.length > 0) {
      this.renderCategoryChart(stats.category_sales);
    }
  }

  bindPeriodSelector() {
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPeriod = e.target.dataset.period;
        this.renderRevenueChart(this.currentPeriod);
      });
    });
  }

  renderRevenueChart(period) {
    const data = this.chartData[period] || [];
    const svg = document.getElementById('revenue-chart');
    const chartLine = document.getElementById('chart-line');
    const chartArea = document.getElementById('chart-area');
    const chartLabels = document.getElementById('chart-labels');
    const chartEmpty = document.getElementById('chart-empty');
    
    if (!svg || !chartLine || !chartArea || !chartLabels || !data || data.length === 0) {
      if (chartEmpty) chartEmpty.style.display = 'block';
      if (chartLine) chartLine.setAttribute('points', '');
      if (chartArea) chartArea.innerHTML = '';
      if (chartLabels) chartLabels.innerHTML = '';
      return;
    }
    
    if (chartEmpty) chartEmpty.style.display = 'none';
    
    const maxValue = Math.max(...data.map(d => d.revenue), 1);
    const padding = { left: 40, right: 20, top: 20, bottom: 20 };
    const chartWidth = 600 - padding.left - padding.right;
    const chartHeight = 180 - padding.top - padding.bottom;
    
    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - (d.revenue / maxValue) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    
    chartLine.setAttribute('points', points);
    
    const areaPoints = `
      ${padding.left},${padding.top + chartHeight} 
      ${points} 
      ${padding.left + chartWidth},${padding.top + chartHeight}
    `.trim();
    chartArea.innerHTML = `<polygon points="${areaPoints}" fill="var(--success)" opacity="0.15"/>`;
    
    const labelCount = Math.min(6, data.length);
    const step = Math.floor(data.length / labelCount);
    chartLabels.innerHTML = data.filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d, i, arr) => {
        const idx = data.indexOf(d);
        const x = padding.left + (idx / (data.length - 1 || 1)) * chartWidth;
        const label = period === 'daily' ? d.date.slice(5) 
                 : period === 'weekly' ? `S${i+1}`
                 : period === 'monthly' ? d.month.slice(5)
                 : d.year;
        return `<text x="${x}" y="195">${escapeHtml(label)}</text>`;
      }).join('');
  }

  renderCategoryChart(categories) {
    let section = document.getElementById('category-sales-section');
    if (!section) {
      const grid = document.querySelector('.dashboard-grid');
      if (!grid) return;
      
      section = document.createElement('article');
      section.id = 'category-sales-section';
      section.className = 'card dashboard-panel';
      section.innerHTML = `
        <div class="panel-heading">
          <div>
            <h3>Ventes par catégorie</h3>
            <p>Répartition du mois en cours.</p>
          </div>
        </div>
        <div class="chart-container">
          <svg id="category-chart" viewBox="0 0 500 250" aria-label="Histogramme des ventes par catégorie" role="img">
            <title>Ventes par catégorie</title>
            <g id="category-bars"/>
            <text id="category-empty" x="250" y="125" fill="var(--text-muted)" font-size="13" text-anchor="middle">Aucune donnée</text>
          </svg>
        </div>
      `;
      grid.appendChild(section);
    }
    
    const barsGroup = document.getElementById('category-bars');
    const emptyText = document.getElementById('category-empty');
    if (!barsGroup || !categories || categories.length === 0) {
      if (emptyText) emptyText.style.display = 'block';
      if (barsGroup) barsGroup.innerHTML = '';
      return;
    }
    
    if (emptyText) emptyText.style.display = 'none';
    
    const maxValue = Math.max(...categories.map(c => c.total_revenue), 1);
    const barWidth = Math.min(60, (450 / categories.length) - 10);
    const chartHeight = 200;
    const padding = { left: 40, top: 20 };
    
    barsGroup.innerHTML = categories.map((c, i) => {
      const barHeight = (c.total_revenue / maxValue) * chartHeight;
      const x = padding.left + i * (barWidth + 10) + 5;
      const y = chartHeight + padding.top - barHeight;
      
      return `
        <g class="category-bar-group">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" 
                fill="var(--accent-color)" rx="3">
            <title>${escapeHtml(c.category_name)}: ${Number(c.total_revenue).toLocaleString()} FCFA</title>
          </rect>
          <text x="${x + barWidth/2}" y="${chartHeight + padding.top + 15}" 
                font-size="8" fill="var(--text-secondary)" text-anchor="middle">
            ${escapeHtml(c.category_name.length > 10 ? c.category_name.slice(0,10)+'…' : c.category_name)}
          </text>
        </g>
      `;
    }).join('');
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
          <div class="payment-track" style="height: 6px; background: var(--bg-tertiary); border-radius: 999px; overflow: hidden;">
            <div class="payment-bar" style="height: 100%; background: var(--accent-color); width: ${pct}%; border-radius: 999px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}
