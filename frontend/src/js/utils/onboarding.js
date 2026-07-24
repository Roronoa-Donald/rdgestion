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
    cta: null,
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
    id: 'add-to-cart',
    title: 'Ajoutez un produit au panier',
    instruction: 'Cliquez sur un produit dans la grille pour l\'ajouter au panier. Le produit que vous venez de créer devrait apparaître.',
    selector: '.pos-grid .product-card, #pos-products-grid .product-card, .pos-grid-item, #pos-products-grid > *',
    route: '#/pos',
    placement: 'right',
    cta: null,
    waitFor: { type: 'dom', selector: '.cart-items .cart-item, #pos-cart-items .cart-item' }
  },
  {
    id: 'validate-sale',
    title: 'Validez la vente',
    instruction: 'Saisissez le montant reçu en espèces (ou choisissez Mobile Money), puis cliquez sur « VALIDER LA VENTE ».',
    selector: '.pos-cart, #payment-extra-details, #btn-validate-sale, #pay-cash-btn, #pay-momo-btn',
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

  /** Helper de debug : log structuré avec préfixe onboarding */
    _log(...args) {
      console.log(`[ONBOARDING:${this.steps[this.currentStepIndex]?.id || '?'}]`, ...args);
    }

    /**
     * Démarre l'onboarding guidé si pas déjà terminé.
     */
    start() {
      const userRaw = localStorage.getItem('user');
      const user = userRaw ? JSON.parse(userRaw) : null;
    
      console.log('[ONBOARDING] start() appelé');
      console.log('[ONBOARDING] user.onboarding_completed =', user?.onboarding_completed);
    
      // Si l'onboarding est marqué comme terminé en BDD (reçu via le user object)
      if (user?.onboarding_completed) {
        console.log('[ONBOARDING] Déjà terminé en BDD, skip');
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        return;
      }

      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true') {
        console.log('[ONBOARDING] Déjà terminé en localStorage, skip');
        return;
      }
      if (this.active) {
        console.log('[ONBOARDING] Déjà actif, skip');
        return;
      }
    
      this.active = true;
      // Reprendre à l'étape sauvegardée si présente
      this.currentStepIndex = (user?.onboarding_step ? user.onboarding_step - 1 : 0);
      if (this.currentStepIndex < 0) this.currentStepIndex = 0;
    
      console.log('[ONBOARDING] Démarrage à l\'étape', this.currentStepIndex, ':', this.steps[this.currentStepIndex]?.id);
    
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
        // ET pour détecter les conditions waitFor de type 'dom' (ex: ajout d'un article au panier)
        this.pollTimer = setInterval(() => {
          if (!this.active) return;
          const step = this.steps[this.currentStepIndex];
          if (!step) return;
      
          // Vérifier la complétion (notamment pour les waitFor de type 'dom')
          this._checkCompletion();
      
          // Suivi du followSelector pour repositionner le spotlight
          if (step.followSelector) {
            const followTarget = this._querySelector(step.followSelector);
            if (followTarget && followTarget !== this._lastFollowTarget) {
              this._lastFollowTarget = followTarget;
              this._positionSpotlight(followTarget);
              this._placeTooltip(step.placement);
            }
          }
        }, 300);
  }

  /**
   * Affiche l'étape courante : tooltip + spotlight sur la cible.
   */
  _renderStep() {
      if (!this.active) {
        this._log('_renderStep ignoré (inactif)');
        return;
      }
      const step = this.steps[this.currentStepIndex];
      if (!step) {
        this._log('_renderStep: plus d\'étapes, finish()');
        this.finish();
        return;
      }

      this._log('_renderStep ÉTAPE', this.currentStepIndex, '/', this.steps.length-1, ':', step.id);
      this._log('selector:', step.selector, '| route:', step.route, '| followSelector:', step.followSelector);
      this._log('hash actuel:', window.location.hash);

      // Réinitialiser le suivi dynamique à chaque nouvelle étape
      this._lastFollowTarget = null;

      // Si l'étape exige une route spécifique et qu'on n'y est pas, on navigue
      if (step.route && !window.location.hash.startsWith(step.route.split('?')[0])) {
        this._log('Navigation vers', step.route);
        window.location.hash = step.route;
        // Le hashchange handler re-rendra l'étape après le chargement de la vue
        return;
      }

      // Attendre que l'élément cible soit dans le DOM
      const tryPosition = (attempts = 0) => {
        const target = this._querySelector(step.selector);
        if (target) {
          this._log('target trouvé après', attempts, 'tentative(s)');
          this._log('target tag:', target.tagName, 'id:', target.id, 'classes:', target.className);
          this._positionSpotlight(target);
          this._renderTooltip(step);
          this._checkCompletion();
        } else if (attempts < 20) {
          if (attempts === 0 || attempts === 5 || attempts === 15) {
            this._log('target NON trouvé, tentative', attempts+1, '/20');
          }
          // Retry : la vue est peut-être encore en train de charger
          setTimeout(() => tryPosition(attempts + 1), 150);
        } else {
          this._log('target introuvable après 20 tentatives, tooltip centré');
          // Cible introuvable : on affiche quand même le tooltip centré
          this._positionSpotlight(null);
          this._renderTooltip(step, true);
        }
      };
      tryPosition();
    }

  /**
     * Positionne les shades + ring autour de l'élément cible.
     * Log complet : position, z-index, dimensions des shades, viewport.
     */
    _positionSpotlight(target) {
      if (!target) {
        target = this._querySelector(this.steps[this.currentStepIndex]?.selector);
      }
      if (!target) {
        this._log('_positionSpotlight: aucune cible trouvée, shades reset');
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 6;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const top = Math.max(0, rect.top - padding);
      const left = Math.max(0, rect.left - padding);
      const width = rect.width + padding * 2;
      const height = rect.height + padding * 2;
      const bottom = Math.max(0, vh - rect.bottom - padding);
      const right = Math.max(0, vw - rect.right - padding);

      this._log('=== _positionSpotlight ===');
      this._log('VIEWPORT:', vw, 'x', vh);
      this._log('TARGET:', target.tagName, '#', target.id, '.', (target.className || '').split(' ').join('.'));
      this._log('TARGET RECT:', { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
      this._log('Z-INDEX computed:', getComputedStyle(target).zIndex);
      this._log('Z-INDEX style attribué:', target.style.zIndex);
      this._log('POSITION computed:', getComputedStyle(target).position);
      // Vérifier le stacking context des parents
      let el = target.parentElement;
      let ctx = 0;
      while (el && el !== document.body) {
        const z = getComputedStyle(el).zIndex;
        const pos = getComputedStyle(el).position;
        if (z !== 'auto' && (pos === 'relative' || pos === 'absolute' || pos === 'fixed' || pos === 'sticky')) {
          ctx++;
          if (ctx <= 3) this._log('  ANCÊTRE stacking:', el.tagName, '#', el.id, 'zIndex:', z, 'position:', pos);
        }
        el = el.parentElement;
      }
      this._log('NOMBRE ancêtres stacking context:', ctx);
      this._log('HOLE (calc):', { top, left, width, height, bottom, right });
      this._log('HOLE (pixels): de (', left, ',', top, ') à (', left+width, ',', top+height, ')');
      this._log('TARGET dans hole ?', (rect.left >= left && rect.right <= left+width && rect.top >= top && rect.bottom <= top+height));
      this._log('SHADES top:', top, 'bottom:', bottom, 'left:', left, 'right:', right);

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

      // Vérifier que les shades ont bien le bon z-index (CSS = 9998)
      const shadeZ = getComputedStyle(this.elements.shades.top).zIndex;
      this._log('SHADES z-index CSS:', shadeZ);

      // FIX: pointer-events: none sur les shades + auto sur la cible et ses enfants
      // pour garantir que les clics passent à travers la zone éclairée
      for (const key of ['top', 'bottom', 'left', 'right']) {
        this.elements.shades[key].style.pointerEvents = 'auto';
      }
      target.style.pointerEvents = 'auto';
      target.querySelectorAll('*').forEach(child => {
        const pe = getComputedStyle(child).pointerEvents;
        if (pe === 'none') {
          child.style.pointerEvents = 'auto';
        }
      });

      this._log('=== FIN _positionSpotlight ===');
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
      const step = this.steps[this.currentStepIndex];
      const target = this._querySelector(step?.selector);
      if (!target) {
        this._log('_placeTooltip: target introuvable pour placement');
        return;
      }

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

      this._log('_placeTooltip placement:', finalPlacement, '-> top:', top, 'left:', left, 'width:', tt.width, 'height:', tt.height);
      this._log('_placeTooltip target rect:', { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
      const afterRect = tooltip.getBoundingClientRect();
      this._log('_placeTooltip position finale tooltip:', { top: afterRect.top, left: afterRect.left, bottom: afterRect.bottom, right: afterRect.right });
      // Vérifier si tooltip overlap la cible
      const overlap = !(rect.left > afterRect.right || rect.right < afterRect.left || rect.top > afterRect.bottom || rect.bottom < afterRect.top);
      if (overlap) this._log('⚠️ tooltip CHEVAUCHE la cible !');
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
      let detail = '';

      if (cond.type === 'route') {
        const currentHash = window.location.hash.split('?')[0];
        done = currentHash === cond.route;
        detail = `hash="${currentHash}" attendu="${cond.route}"`;
      } else if (cond.type === 'storage') {
        const val = localStorage.getItem(cond.key);
        done = val === cond.value;
        detail = `key="${cond.key}" value="${val}" attendu="${cond.value}"`;
      } else if (cond.type === 'dom') {
        const el = this._querySelector(cond.selector);
        done = !!el;
        detail = `selector="${cond.selector}" trouvé=${!!el}`;
      }

      this._log('_checkCompletion step:', step.id, 'type:', cond.type);
      this._log('  =>', detail, '| done =', done);

      if (done) {
        this._advance();
      }
    }

    /**
     * Passe à l'étape suivante (ou termine si dernière).
     */
    _advance() {
      this._log('_advance de l\'étape', this.currentStepIndex, this.steps[this.currentStepIndex]?.id, '→', this.currentStepIndex + 1);
      this.currentStepIndex++;
      this._lastFollowTarget = null;
      if (this.currentStepIndex >= this.steps.length) {
        this._log('_advance: FIN — toutes les étapes complétées');
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
        this._log('_advance: prochaine étape', this.currentStepIndex, this.steps[this.currentStepIndex]?.id);
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
