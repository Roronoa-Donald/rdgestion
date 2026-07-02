import { API } from '../api.js';
import { escapeHtml } from '../utils.js';

const SETUP_DISMISSED_KEY = 'rdg_setup_dismissed';
const SETUP_REFERRAL_SEEN_KEY = 'rdg_setup_referral_seen';
const SETUP_PRODUCT_CREATED_KEY = 'rdg_setup_product_created';

export class DashboardView {
  async render() {
    return `
      <div class="dashboard-page fade-in">
        <section id="dashboard-setup-guide" class="setup-card" style="display: none;"></section>

        <section id="dashboard-stock-alert" class="notice notice-warning" style="display: none;">
          <div>
            <strong>Stock a surveiller</strong>
            <p id="dashboard-stock-alert-text"></p>
          </div>
          <a href="#/products" class="btn btn-secondary btn-sm">Gerer le stock</a>
        </section>

        <section class="metric-grid" aria-label="Indicateurs du jour">
          <article class="metric-card">
            <span class="metric-label">Chiffre d'affaires aujourd'hui</span>
            <strong id="dash-revenue" class="metric-value">0 FCFA</strong>
            <span id="dash-trend" class="metric-note"></span>
          </article>

          <article class="metric-card">
            <span class="metric-label">Benefice estime</span>
            <strong id="dash-profit" class="metric-value">0 FCFA</strong>
            <span class="metric-note">Marge nette journaliere</span>
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
            <span class="metric-note">Catalogue disponible a la vente</span>
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
                    <th style="text-align: center;">Quantite vendue</th>
                    <th style="text-align: right;">Chiffre d'affaires</th>
                  </tr>
                </thead>
                <tbody id="top-products-body">
                  <tr>
                    <td colspan="3">
                      <div class="empty-state compact">
                        <strong>Aucune vente pour le moment</strong>
                        <span>Les meilleurs produits apparaitront apres vos premieres ventes.</span>
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
                <p>Repartition du mois en cours.</p>
              </div>
            </div>
            <div id="payment-methods-list" class="payment-list">
              <div class="empty-state compact">
                <strong>Pas encore de paiement</strong>
                <span>La repartition apparaitra apres la premiere vente.</span>
              </div>
            </div>
          </article>
        </section>
      </div>
    `;
  }

  async afterRender() {
    document.getElementById('current-view-title').textContent = 'Vue d ensemble';

    try {
      const res = await API.dashboard.getStats();
      const stats = res.data;
      const currency = 'FCFA';

      document.getElementById('dash-revenue').textContent = `${Number(stats.today.revenue).toLocaleString()} ${currency}`;
      document.getElementById('dash-profit').textContent = `${Number(stats.today.profit).toLocaleString()} ${currency}`;
      document.getElementById('dash-sales').textContent = stats.today.sale_count;
      document.getElementById('dash-products').textContent = stats.products.total;

      this.renderRevenueTrend(stats.today.revenue_trend_percent);
      this.renderDailyLimit(stats.today);
      this.renderStockAlert(stats.products.low_stock);
      this.renderSetupGuide(stats);
      this.renderTopProducts(stats.top_products, currency);
      this.renderPaymentMethods(stats.payment_methods, currency);
    } catch (error) {
      console.error(error);
    }
  }

  renderRevenueTrend(trendVal) {
    const trendEl = document.getElementById('dash-trend');
    if (trendVal > 0) {
      trendEl.textContent = `+${trendVal}% par rapport a hier`;
      trendEl.style.color = 'var(--success)';
    } else if (trendVal < 0) {
      trendEl.textContent = `${trendVal}% par rapport a hier`;
      trendEl.style.color = 'var(--error)';
    } else {
      trendEl.textContent = 'Stable par rapport a hier';
      trendEl.style.color = 'var(--text-secondary)';
    }
  }

  renderDailyLimit(today) {
    if (today.daily_limit_max === null) return;

    document.getElementById('limit-container').style.display = 'block';
    document.getElementById('limit-text').textContent = `${today.daily_limit_count} / ${today.daily_limit_max}`;
    const pct = Math.min(100, (today.daily_limit_count / today.daily_limit_max) * 100);
    const bar = document.getElementById('limit-bar');
    bar.style.width = `${pct}%`;
    if (pct >= 85) {
      bar.style.backgroundColor = 'var(--error)';
    } else if (pct >= 60) {
      bar.style.backgroundColor = 'var(--warning)';
    }
  }

  renderStockAlert(lowStockCount) {
    if (lowStockCount <= 0) return;

    document.getElementById('dashboard-stock-alert').style.display = 'flex';
    document.getElementById('dashboard-stock-alert-text').textContent =
      `${lowStockCount} produit(s) sont en stock faible ou en rupture.`;
  }

  renderSetupGuide(stats) {
    const guide = document.getElementById('dashboard-setup-guide');
    const dismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === 'true';
    const productDone = Number(stats.products.total) > 0 || localStorage.getItem(SETUP_PRODUCT_CREATED_KEY) === 'true';
    const referralDone = localStorage.getItem(SETUP_REFERRAL_SEEN_KEY) === 'true';

    const steps = [
      {
        title: 'Creer votre premier produit',
        text: 'Ajoutez un article avec son prix, son stock et son seuil d alerte.',
        done: productDone,
        action: 'Ajouter un produit',
        href: '#/products?new=1&fromSetup=1'
      },
      {
        title: 'Voir votre code de parrainage',
        text: 'Reperez le code a partager aux autres commercants avant de quitter le demarrage.',
        done: referralDone,
        action: 'Ouvrir le parrainage',
        href: '#/settings?tab=referrals&fromSetup=1'
      }
    ];

    const completed = steps.filter(step => step.done).length;
    if (dismissed || completed === steps.length) {
      guide.style.display = 'none';
      return;
    }

    const progressPct = Math.round((completed / steps.length) * 100);
    guide.style.display = 'block';
    guide.innerHTML = `
      <div class="setup-header">
        <div>
          <span class="eyebrow">Demarrage guide</span>
          <h2>Votre boutique est presque prete</h2>
          <p>Deux gestes suffisent pour transformer un tableau de bord vide en espace de travail utile.</p>
        </div>
        <div class="setup-progress-summary">
          <strong>${completed}/${steps.length}</strong>
          <span>etapes faites</span>
        </div>
      </div>

      <div class="setup-progress-track" aria-hidden="true">
        <div class="setup-progress-bar" style="width: ${progressPct}%;"></div>
      </div>

      <div class="setup-steps">
        ${steps.map((step, index) => `
          <article class="setup-step ${step.done ? 'is-done' : ''}">
            <div class="setup-step-index">${step.done ? 'OK' : `0${index + 1}`}</div>
            <div class="setup-step-copy">
              <strong>${step.title}</strong>
              <span>${step.text}</span>
            </div>
            <a class="btn ${step.done ? 'btn-secondary' : 'btn-primary'} btn-sm" href="${step.href}">
              ${step.done ? 'Revoir' : step.action}
            </a>
          </article>
        `).join('')}
      </div>

      <div class="setup-footer">
        <span>Vous pouvez ignorer ce guide et le faire plus tard depuis le menu.</span>
        <button id="skip-setup-guide" class="btn btn-secondary btn-sm" type="button">Ignorer</button>
      </div>
    `;

    document.getElementById('skip-setup-guide')?.addEventListener('click', () => {
      const confirmed = confirm('Ignorer l accompagnement de demarrage ? Vous pourrez toujours creer vos produits et consulter le parrainage plus tard.');
      if (!confirmed) return;
      localStorage.setItem(SETUP_DISMISSED_KEY, 'true');
      guide.style.display = 'none';
    });
  }

  renderTopProducts(products, currency) {
    const topBody = document.getElementById('top-products-body');
    if (!products || products.length === 0) return;

    topBody.innerHTML = products.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.product_name)}</strong></td>
        <td style="text-align: center;"><span class="badge">${p.total_quantity}</span></td>
        <td style="text-align: right; font-weight: 600;">${Number(p.total_revenue).toLocaleString()} ${currency}</td>
      </tr>
    `).join('');
  }

  renderPaymentMethods(methods, currency) {
    const payList = document.getElementById('payment-methods-list');
    if (!methods || methods.length === 0) return;

    const totalPay = methods.reduce((sum, item) => sum + Number(item.total_amount), 0);
    payList.innerHTML = methods.map(p => {
      const pct = totalPay > 0 ? Math.round((Number(p.total_amount) / totalPay) * 100) : 0;
      const methodLabel = p.payment_method === 'MOBILE_MONEY' ? 'Mobile Money' : 'Especes';

      return `
        <div class="payment-row">
          <div class="payment-row-head">
            <strong>${methodLabel}</strong>
            <span>${Number(p.total_amount).toLocaleString()} ${currency} (${pct}%)</span>
          </div>
          <div class="payment-track">
            <div class="payment-bar" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}
