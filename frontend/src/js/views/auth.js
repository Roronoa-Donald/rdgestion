import { API } from '../api.js';
import { Toast, withLoading, Skeletons } from '../utils/ui.js';

const SETUP_KEYS = [
  'rdg_setup_dismissed',
  'rdg_setup_product_created',
  'rdg_setup_referral_seen'
];

function resetSetupGuide() {
  SETUP_KEYS.forEach(key => localStorage.removeItem(key));
}

function renderAuthShell(title, subtitle, body, footer, cardStyle = '') {
  return `
    <div class="auth-shell">
      <section class="auth-card fade-in" style="${cardStyle}">
        <div class="auth-header">
          <div class="logo-icon auth-logo">RD</div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        ${body}
        ${footer}
      </section>
    </div>
  `;
}

export class LoginView {
  async render() {
    return renderAuthShell(
      'Bon retour sur RDGESTION',
      'Connectez-vous pour reprendre la gestion de votre boutique.',
      `
        <div id="login-error" class="badge badge-danger auth-error" role="alert"></div>

        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-phone">Identifiant</label>
            <input class="form-input" type="text" id="login-phone" placeholder="+22890123456 ou vendeur.boutique-123" required autocomplete="username">
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Mot de passe</label>
            <input class="form-input" type="password" id="login-password" placeholder="********" required autocomplete="current-password">
          </div>

          <button type="submit" class="btn btn-primary auth-submit">Se connecter</button>
        </form>
      `,
      `
        <div class="auth-footer">
          Pas encore de compte ? <a href="#/register">Inscrire votre boutique</a>
        </div>
      `
    );
  }

  async afterRender() {
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';

      const identifier = document.getElementById('login-phone').value.trim();
      const password = document.getElementById('login-password').value;

      const btn = form.querySelector('.auth-submit');
      try {
        await withLoading(btn, async () => {
          const res = await API.auth.login({ identifier, password });
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));

          if (res.user.role === 'ADMIN') {
            try {
              const categories = await API.categories.list();
              if (categories.length <= 1) {
                resetSetupGuide();
                window.location.hash = '#/onboarding';
                return;
              }
            } catch (e) {
              console.error('Erreur verification onboarding categories :', e);
            }
            window.location.hash = '#/dashboard';
          } else if (res.user.role === 'SELLER') {
            window.location.hash = '#/pos';
          } else {
            window.location.hash = '#/admin';
          }
        }, "Connexion en cours...");
      } catch (err) {
        errorEl.textContent = err.message || 'Identifiants invalides.';
        errorEl.style.display = 'block';
        Toast.error(err.message || 'Identifiants invalides.');
      }
    });
  }
}

export class RegisterView {
  async render() {
    return renderAuthShell(
      'Créer votre espace boutique',
      'Quelques informations suffisent pour ouvrir votre espace de gestion.',
      `
        <div id="register-error" class="badge badge-danger auth-error" role="alert"></div>

        <form id="register-form">
          <div class="form-group">
            <label class="form-label" for="reg-shop">Nom du commerce</label>
            <input class="form-input" type="text" id="reg-shop" placeholder="Pharmacie du Point G" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-owner">Nom du propriétaire / gérant</label>
            <input class="form-input" type="text" id="reg-owner" placeholder="Fatou Diop" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-phone">Numéro de téléphone portable</label>
            <input class="form-input" type="tel" id="reg-phone" placeholder="+22890123456" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-pass">Mot de passe</label>
            <input class="form-input" type="password" id="reg-pass" placeholder="8 caractères min, 1 majuscule, 1 chiffre" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-confirm">Confirmer le mot de passe</label>
            <input class="form-input" type="password" id="reg-confirm" placeholder="Répéter le mot de passe" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-referral">Code parrainage optionnel</label>
            <input class="form-input" type="text" id="reg-referral" placeholder="RD-BOUTIQUE-123">
          </div>

          <div class="form-group" style="margin-top: 24px; margin-bottom: 24px;">
            <label class="form-label" style="margin-bottom: 12px; display: block;">Type(s) de commerce / Secteur(s) d'activité</label>
            <div class="onboarding-sector-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 0;">
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Alimentation générale" style="width: 16px; height: 16px;">
                <span>Alimentation générale</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Pharmacie / Parapharmacie" style="width: 16px; height: 16px;">
                <span>Pharmacie / Médical</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Quincaillerie / Bricolage" style="width: 16px; height: 16px;">
                <span>Quincaillerie</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Vêtements / Accessoires / Mode" style="width: 16px; height: 16px;">
                <span>Vêtements & Mode</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Informatique / Téléphonie" style="width: 16px; height: 16px;">
                <span>Informatique & Mobile</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Cosmétiques / Beauté" style="width: 16px; height: 16px;">
                <span>Cosmétiques & Beauté</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Restaurant / Snack / Buvette" style="width: 16px; height: 16px;">
                <span>Restauration</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Librairie / Papeterie" style="width: 16px; height: 16px;">
                <span>Librairie & Papeterie</span>
              </label>
              <label class="sector-checkbox" style="padding: 10px 12px; font-size: 13px; gap: 8px;">
                <input type="checkbox" name="sector" value="Électroménager" style="width: 16px; height: 16px;">
                <span>Électroménager</span>
              </label>
            </div>
          </div>

          <button type="submit" class="btn btn-primary auth-submit">Créer mon espace</button>
        </form>
      `,
      `
        <div class="auth-footer">
          Déjà inscrit ? <a href="#/login">Se connecter</a>
        </div>
      `,
      'max-width: 520px;'
    );
  }

  async afterRender() {
    const form = document.getElementById('register-form');
    const errorEl = document.getElementById('register-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';

      const shop_name = document.getElementById('reg-shop').value.trim();
      const owner_name = document.getElementById('reg-owner').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const password = document.getElementById('reg-pass').value;
      const password_confirm = document.getElementById('reg-confirm').value;
      const referral_code = document.getElementById('reg-referral').value.trim() || undefined;

      if (password !== password_confirm) {
        errorEl.textContent = 'Les deux mots de passe ne correspondent pas.';
        errorEl.style.display = 'block';
        return;
      }

      if (password.length < 8) {
        errorEl.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
        errorEl.style.display = 'block';
        return;
      }

      const hasUppercase = /[A-Z]/.test(password);
      const hasNumber = /\d/.test(password);
      if (!hasUppercase || !hasNumber) {
        errorEl.textContent = 'Le mot de passe doit contenir au moins une lettre majuscule et un chiffre.';
        errorEl.style.display = 'block';
        return;
      }

      const checkboxes = document.querySelectorAll('input[name="sector"]:checked');
      const sectors = Array.from(checkboxes).map(cb => cb.value);

      const btn = form.querySelector('.auth-submit');
      try {
        await withLoading(btn, async () => {
          const res = await API.auth.register({
            shop_name, owner_name, phone, password, password_confirm, referral_code, sectors
          });
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
          resetSetupGuide();
          Toast.success('Boutique créée avec succès !');
          window.location.hash = '#/dashboard';
        }, "Création de votre compte...");
      } catch (err) {
        errorEl.textContent = err.message || 'Erreur lors de l inscription.';
        errorEl.style.display = 'block';
        Toast.error(err.message || 'Erreur lors de l inscription.');
      }
    });
  }
}

export class OnboardingView {
  async render() {
    return `
      <div class="onboarding-shell fade-in">
        <section class="onboarding-card">
          <div class="onboarding-header">
            <span class="eyebrow">Etape 1 sur 3</span>
            <h2>Préparer les catégories de départ</h2>
            <p>Choisissez les secteurs proches de votre commerce. RDGESTION créera les premières catégories de votre catalogue.</p>
          </div>

          <div class="setup-progress-track" aria-hidden="true">
            <div class="setup-progress-bar" style="width: 33%;"></div>
          </div>

          <div class="onboarding-next-steps" aria-label="Etapes suivantes">
            <div class="onboarding-step-preview is-active">
              <strong>1</strong>
              <span>Catégories</span>
            </div>
            <div class="onboarding-step-preview">
              <strong>2</strong>
              <span>Premier produit</span>
            </div>
            <div class="onboarding-step-preview">
              <strong>3</strong>
              <span>Code parrainage</span>
            </div>
          </div>

          <form id="onboarding-form">
            <div class="onboarding-sector-grid">
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Alimentation générale">
                <span>Alimentation générale</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Pharmacie / Parapharmacie">
                <span>Pharmacie / Médical</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Quincaillerie / Bricolage">
                <span>Quincaillerie / Matériaux</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Vêtements / Accessoires / Mode">
                <span>Vêtements & mode</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Informatique / Téléphonie">
                <span>Informatique & mobile</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Cosmétiques / Beauté">
                <span>Cosmétiques & beauté</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Restaurant / Snack / Buvette">
                <span>Snack / restauration</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Librairie / Papeterie">
                <span>Librairie / papeterie</span>
              </label>
              <label class="sector-checkbox">
                <input type="checkbox" name="sector" value="Électroménager">
                <span>Électroménager</span>
              </label>
            </div>

            <div class="onboarding-actions">
              <button type="button" id="onboarding-skip" class="btn btn-secondary">Passer pour l'instant</button>
              <button type="submit" class="btn btn-primary">Continuer</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  async afterRender() {
    const form = document.getElementById('onboarding-form');
    const skipBtn = document.getElementById('onboarding-skip');

    const continueToDashboard = async (sectors) => {
      try {
        await API.categories.seed(sectors);
      } catch (err) {
        console.error('Erreur seed categories onboarding :', err);
      }

      localStorage.removeItem('rdg_setup_dismissed');
      window.location.hash = '#/dashboard';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll('input[name="sector"]:checked');
      const sectors = Array.from(checkboxes).map(cb => cb.value);

      const btn = form.querySelector('.btn-primary');
      await withLoading(btn, async () => {
        await continueToDashboard(sectors);
      }, "Configuration du catalogue...");
    });

    skipBtn.addEventListener('click', async () => {
      const confirmed = confirm('Passer la configuration des catégories ? Une catégorie Autres sera créée et vous pourrez organiser le catalogue plus tard.');
      if (!confirmed) return;

      await withLoading(skipBtn, async () => {
        await continueToDashboard([]);
      }, "Passage en cours...");
    });
  }
}
