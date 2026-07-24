/* ==========================================
 * RDGESTION — Onboarding Guidé (Spotlight)
 * Moteur JS : overlay flouté + zone éclairée
 * + tooltip avec progression X/Y.
 * Bloquant : l'utilisateur doit terminer les 4 étapes.
 * ========================================== */

import { API } from '../api.js';

const ONBOARDING_STORAGE_KEY = 'rdg_guided_onboarding_done';

/**
 * Définition des étapes de l'onboarding guidé.
 * Chaque étape :
 *  - id           : identifiant unique
 *  - title        : grand titre affiché
 *  - instruction  : texte court et concis
 *  - selector      : sélecteur CSS de la zone à éclairer (spotlight)
 *  - route        : route hash cible (#/products, #/pos, #/settings...)
 *  - waitFor      : condition de complétion (événement API / localStorage / DOM)
 *  - cta          : libellé du bouton d'action (navigation)
 *  - placement    : position du tooltip (top|bottom|left|right)
 */
const ONBOARDING_STEPS = [
  {
    id: 'go-to-products',
    title: 'Ajoutons votre premier produit',
    instruction: 'Rendez-vous dans la section Produits pour créer votre premier article. Cliquez sur « Produits » dans le menu.',
    selector: '#nav-products a, #bottom-nav-products',
    route: '#/products',
    placement: 'right',
    cta: 'Aller aux produits',
    waitFor: { type: 'route', route: '#/products' }
  },
  {
    id: 'create-product',
    title: 'Créez votre premier produit',
    instruction: 'Cliquez sur le bouton « Nouveau produit » puis remplissez le formulaire (nom, prix, stock). Validez pour l\'enregistrer.',
    selector: '#btn-new-prod',
    followSelector: '#modal-container .modal-content',
    route: '#/products',
    placement: 'bottom',
    cta: null, // Pas de bouton : l'utilisateur doit cliquer sur la zone spotlight
    waitFor: { type: 'storage', key: 'rdg_setup_product_created', value: 'true' }
  },
  {
    id: 'go-to-pos',
    title: 'Encaissez votre première vente',
    instruction: 'Direction le Point de Vente. Cliquez sur « POS » dans le menu pour encaisser votre première vente.',
    selector: '#nav-pos a, #bottom-nav-pos',
    route: '#/pos',
    placement: 'right',
    cta: 'Aller au POS',
    waitFor: { type: 'route', route: '#/pos' }
  },
  {
    id: 'validate-sale',
    title: 'Validez une vente test',
    instruction: 'Ajoutez un produit au panier, saisissez le montant reçu en espèces, puis cliquez sur « VALIDER LA VENTE ».',
    selector: '#btn-validate-sale',
    followSelector: '#pos-modal-container .modal-content',
    route: '#/pos',
    placement: 'top',
    cta: null,
    waitFor: { type: 'storage', key: 'rdg_setup_sale_validated', value: 'true' }
  },
  {
    id: 'go-to-referrals',
    title: 'Découvrez votre code de parrainage',
    instruction: 'Allez dans les Paramètres pour récupérer votre code de parrainage unique et gagner des mois PRO gratuits.',
    selector: '#nav-settings a, #bottom-nav-settings',
    route: '#/settings?tab=referrals&fromSetup=1',
    placement: 'right',
    cta: 'Aller au parrainage',
    waitFor: { type: 'route', route: '#/settings' }
  },
  {
    id: 'copy-referral',
    title: 'Copiez votre code de parrainage',
    instruction: 'Cliquez sur « Copier le code » pour récupérer votre code unique. Vous pourrez le partager à vos confrères.',
    selector: '#btn-copy-code',
    followSelector: '#btn-copy-code',
    route: '#/settings',
    placement: 'top',
    cta: null,
    waitFor: { type: 'storage', key: 'rdg_setup_referral_seen', value: 'true' }
  }
];

class GuidedOnboarding {
  constructor() {
    this.steps = ONBOARDING_STEPS;
    this.currentStepIndex = 0;
    this.active = false;
    this.elements = {};
    this.resizeHandler = null;
    this.scrollHandler = null;
    this.hashHandler = null;
    this.storageHandler = null;
    this.pollTimer = null;
    this._lastFollowTarget = null;
  }

  /**
   * Démarre l'onboarding guidé si pas déjà terminé.
   */
  start() {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    
    // Si l'onboarding est marqué comme terminé en BDD (reçu via le user object)
    if (user?.onboarding_completed) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      return;
    }

    if (localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true') return;
    if (this.active) return;
    
    this.active = true;
    // Reprendre à l'étape sauvegardée si présente
    this.currentStepIndex = (user?.onboarding_step ? user.onboarding_step - 1 : 0);
    if (this.currentStepIndex < 0) this.currentStepIndex = 0;
    
    this._buildOverlay();
    this._attachListeners();
    this._renderStep();
  }

  /**
   * Marque l'onboarding comme terminé et nettoie le DOM.
   */
  async finish() {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    this.active = false;
    
    // Persister en BDD
    try {
      await API.settings.update({ onboarding_completed: true });
      // Mettre à jour le cache local du user
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        user.onboarding_completed = true;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (err) {
      console.error('Erreur sauvegarde completion onboarding :', err);
    }
    
    this._cleanup();
  }

  /**
   * Construit les éléments DOM de l'overlay (shades + ring + tooltip).
   */
  _buildOverlay() {
    // Nettoyer un éventuel résidu
    this._removeOverlay();

    const html = `
      <div class="rdg-spotlight-shade top"    data-rdg-shade="top"></div>
      <div class="rdg-spotlight-shade bottom" data-rdg-shade="bottom"></div>
      <div class="rdg-spotlight-shade left"   data-rdg-shade="left"></div>
      <div class="rdg-spotlight-shade right"  data-rdg-shade="right"></div>
      <div class="rdg-spotlight-ring" data-rdg-ring></div>
      <div class="rdg-onboarding-tooltip" data-rdg-tooltip role="dialog" aria-modal="false" aria-labelledby="rdg-tt-title"></div>
    `;
    const container = document.createElement('div');
    container.id = 'rdg-onboarding-root';
    container.innerHTML = html;
    document.body.appendChild(container);

    this.elements = {
      root: container,
      shades: {
        top: container.querySelector('[data-rdg-shade="top"]'),
        bottom: container.querySelector('[data-rdg-shade="bottom"]'),
        left: container.querySelector('[data-rdg-shade="left"]'),
        right: container.querySelector('[data-rdg-shade="right"]')
      },
      ring: container.querySelector('[data-rdg-ring]'),
      tooltip: container.querySelector('[data-rdg-tooltip]')
    };
  }

  _removeOverlay() {
    const existing = document.getElementById('rdg-onboarding-root');
    if (existing) existing.remove();
  }

  /**
   * Attache les listeners globaux (resize, scroll, hashchange, storage).
   */
  _attachListeners() {
    this.resizeHandler = () => this._positionSpotlight();
    window.addEventListener('resize', this.resizeHandler);

    this.scrollHandler = () => this._positionSpotlight();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    this.hashHandler = () => {
      // Après un changement de route, on repositionne sur l'étape courante
      // (la vue peut mettre un instant à se charger).
      // Mais d'abord vérifier si la route courante complète l'étape,
      // pour éviter un re-render inutile avant l'avancement.
      this._checkCompletion();
      setTimeout(() => {
        if (this.active) this._renderStep();
      }, 350);
    };
    window.addEventListener('hashchange', this.hashHandler);

    // Écoute des changements de localStorage (cross-tab + same-tab via custom event)
    this.storageHandler = (e) => {
      if (e.key === null) return;
      this._checkCompletion();
    };
    window.addEventListener('storage', this.storageHandler);
    window.addEventListener('rdg-localstorage', this.storageHandler);

    // Polling DOM pour suivre dynamiquement le followSelector (ex: modale qui s'ouvre)
    this.pollTimer = setInterval(() => {
      if (!this.active) return;
      const step = this.steps[this.currentStepIndex];
      if (!step || !step.followSelector) return;
      const followTarget = this._querySelector(step.followSelector);
      if (followTarget && followTarget !== this._lastFollowTarget) {
        this._lastFollowTarget = followTarget;
        this._positionSpotlight(followTarget);
        this._placeTooltip(step.placement);
      }
    }, 300);
  }

  /**
   * Affiche l'étape courante : tooltip + spotlight sur la cible.
   */
  _renderStep() {
    if (!this.active) return;
    const step = this.steps[this.currentStepIndex];
    if (!step) {
      this.finish();
      return;
    }

    // Réinitialiser le suivi dynamique à chaque nouvelle étape
    this._lastFollowTarget = null;

    // Si l'étape exige une route spécifique et qu'on n'y est pas, on navigue
    if (step.route && !window.location.hash.startsWith(step.route.split('?')[0])) {
      window.location.hash = step.route;
      // Le hashchange handler re-rendra l'étape après le chargement de la vue
      return;
    }

    // Attendre que l'élément cible soit dans le DOM
    const tryPosition = (attempts = 0) => {
      const target = this._querySelector(step.selector);
      if (target) {
        this._positionSpotlight(target);
        this._renderTooltip(step);
        this._checkCompletion();
      } else if (attempts < 20) {
        // Retry : la vue est peut-être encore en train de charger
        setTimeout(() => tryPosition(attempts + 1), 150);
      } else {
        // Cible introuvable : on affiche quand même le tooltip centré
        this._positionSpotlight(null);
        this._renderTooltip(step, true);
      }
    };
    tryPosition();
  }

  /**
   * Positionne les shades + ring autour de l'élément cible.
   */
  _positionSpotlight(target) {
    if (!target) {
      target = this._querySelector(this.steps[this.currentStepIndex]?.selector);
    }
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const padding = 6; // marge autour de la zone éclairée

    const top = Math.max(0, rect.top - padding);
    const left = Math.max(0, rect.left - padding);
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2;
    const bottom = Math.max(0, window.innerHeight - rect.bottom - padding);
    const right = Math.max(0, window.innerWidth - rect.right - padding);

    // Shades
    this.elements.shades.top.style.height = `${top}px`;
    this.elements.shades.bottom.style.height = `${bottom}px`;
    this.elements.shades.left.style.width = `${left}px`;
    this.elements.shades.right.style.width = `${right}px`;

    // Ring (halo)
    this.elements.ring.style.top = `${top}px`;
    this.elements.ring.style.left = `${left}px`;
    this.elements.ring.style.width = `${width}px`;
    this.elements.ring.style.height = `${height}px`;

    // CRITICAL FIX: Pour permettre l'interaction avec l'élément cible et ses enfants,
    // on augmente son z-index temporairement pour qu'il passe au-dessus des shades.
    const originalZIndex = target.style.zIndex;
    target.style.zIndex = '10000';
    target.style.position = 'relative';

    // On stocke l'élément pour pouvoir rétablir son z-index plus tard
    this._currentTarget = target;
    this._originalZIndex = originalZIndex;

    // S'assurer que la cible est visible (scroll si hors viewport)
    if (rect.top < 80 || rect.bottom > window.innerHeight - 20) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Affiche le tooltip avec titre, progression et instruction.
   */
  _renderTooltip(step, centered = false) {
    const total = this.steps.length;
    const current = this.currentStepIndex + 1;
    const progressPct = Math.round(((current - 1) / total) * 100);

    const ctaHtml = step.cta
      ? `<button class="rdg-tt-btn rdg-tt-btn-primary" data-rdg-cta>${this._escapeHtml(step.cta)}</button>`
      : `<span class="rdg-tt-hint"><span class="rdg-tt-hint-dot"></span>Cliquez sur la zone mise en évidence</span>`;

    this.elements.tooltip.innerHTML = `
      <div class="rdg-tt-header">
        <span class="rdg-tt-eyebrow">Accompagnement</span>
        <span class="rdg-tt-counter">Étape ${current} / ${total}</span>
      </div>
      <h2 class="rdg-tt-title" id="rdg-tt-title">${this._escapeHtml(step.title)}</h2>
      <div class="rdg-tt-progress" aria-hidden="true">
        <div class="rdg-tt-progress-track">
          <div class="rdg-tt-progress-bar" style="width: ${progressPct}%;"></div>
        </div>
        <div class="rdg-tt-progress-label">
          <span>${current - 1} action${current - 1 > 1 ? 's' : ''} complétée${current - 1 > 1 ? 's' : ''}</span>
          <span>${progressPct}%</span>
        </div>
      </div>
      <p class="rdg-tt-instruction">${this._escapeHtml(step.instruction)}</p>
      <div class="rdg-tt-actions">
        ${ctaHtml}
      </div>
    `;

    // Placement du tooltip
    if (centered) {
      this.elements.tooltip.style.top = '50%';
      this.elements.tooltip.style.left = '50%';
      this.elements.tooltip.style.transform = 'translate(-50%, -50%)';
      this.elements.tooltip.removeAttribute('data-placement');
    } else {
      this._placeTooltip(step.placement);
    }

    // Bouton CTA : naviguer vers la route
    const ctaBtn = this.elements.tooltip.querySelector('[data-rdg-cta]');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        if (step.route) {
          window.location.hash = step.route;
        }
      });
    }
  }

  /**
   * Positionne le tooltip selon le placement demandé, en évitant les débordements.
   */
  _placeTooltip(placement) {
    const tooltip = this.elements.tooltip;
    const target = this._querySelector(this.steps[this.currentStepIndex].selector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const tt = tooltip.getBoundingClientRect();
    const margin = 14;
    let top, left, finalPlacement = placement;

    // Calcul initial selon placement demandé
    if (placement === 'bottom') {
      top = rect.bottom + margin;
      left = rect.left;
    } else if (placement === 'top') {
      top = rect.top - tt.height - margin;
      left = rect.left;
    } else if (placement === 'right') {
      top = rect.top;
      left = rect.right + margin;
    } else { // left
      top = rect.top;
      left = rect.left - tt.width - margin;
    }

    // Ajustements pour éviter les débordements d'écran (desktop)
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (left + tt.width > vw - 12) left = vw - tt.width - 12;
    if (left < 12) left = 12;
    if (top + tt.height > vh - 12) top = vh - tt.height - 12;
    if (top < 12) top = 12;

    // Si on est sur mobile, le CSS force la tooltip en bas plein écran
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.transform = 'none';
    tooltip.setAttribute('data-placement', finalPlacement);
  }

  /**
   * Vérifie si l'étape courante est complétée selon sa condition `waitFor`.
   */
  _checkCompletion() {
    if (!this.active) return;
    const step = this.steps[this.currentStepIndex];
    if (!step || !step.waitFor) return;

    const cond = step.waitFor;
    let done = false;

    if (cond.type === 'route') {
      const currentHash = window.location.hash.split('?')[0];
      done = currentHash === cond.route;
    } else if (cond.type === 'storage') {
      done = localStorage.getItem(cond.key) === cond.value;
    } else if (cond.type === 'dom') {
      done = !!this._querySelector(cond.selector);
    }

    if (done) {
      this._advance();
    }
  }

  /**
   * Passe à l'étape suivante (ou termine si dernière).
   */
  _advance() {
    this.currentStepIndex++;
    this._lastFollowTarget = null;
    if (this.currentStepIndex >= this.steps.length) {
      this.finish();
      // Rediriger vers le dashboard à la fin
      window.location.hash = '#/dashboard';
      // Notification de fin
      setTimeout(() => {
        import('../utils/ui.js').then(({ Toast }) => {
          Toast.success('Onboarding terminé ! Votre espace est prêt.');
        }).catch(() => {});
      }, 400);
    } else {
      // Petite pause pour laisser l'animation de l'action se terminer
      setTimeout(() => this._renderStep(), 500);
    }
  }

  /**
   * Nettoie listeners + DOM.
   */
  _cleanup() {
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.scrollHandler) window.removeEventListener('scroll', this.scrollHandler);
    if (this.hashHandler) window.removeEventListener('hashchange', this.hashHandler);
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      window.removeEventListener('rdg-localstorage', this.storageHandler);
    }
    if (this.pollTimer) clearInterval(this.pollTimer);
    
    // Rétablir le z-index de la dernière cible
    if (this._currentTarget) {
      this._currentTarget.style.zIndex = this._originalZIndex || '';
    }
    
    this._removeOverlay();
  }

  /**
   * Helper : querySelector qui supporte les sélecteurs multiples (comma).
   */
  _querySelector(selector) {
    if (!selector) return null;
    const parts = selector.split(',').map(s => s.trim());
    for (const p of parts) {
      const el = document.querySelector(p);
      if (el) return el;
    }
    return null;
  }

  /**
   * Helper : échappe le HTML pour éviter les injections.
   */
  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#039;');
  }
}

// Singleton
export const guidedOnboarding = new GuidedOnboarding();

/**
 * Déclenche un event custom pour signaler qu'une clé localStorage a changé
 * (utile car l'événement `storage` ne se déclenche pas dans le même tab).
 */
export function notifyLocalStorageChange(key) {
  window.dispatchEvent(new CustomEvent('rdg-localstorage', { detail: { key } }));
}

/**
 * Indique si l'onboarding guidé a déjà été terminé.
 */
export function isGuidedOnboardingDone() {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
}

/**
 * Indique si l'onboarding guidé est actuellement en cours (actif).
 */
export function guidedOnboardingActive() {
  return guidedOnboarding.active;
}

/**
 * Retourne la route hash de l'étape courante de l'onboarding (ex: '#/products').
 * Utilisé par le router pour empêcher la navigation en dehors des routes de l'onboarding.
 */
export function guidedOnboardingCurrentRoute() {
  if (!guidedOnboarding.active) return null;
  const step = guidedOnboarding.steps[guidedOnboarding.currentStepIndex];
  return step?.route || null;
}
