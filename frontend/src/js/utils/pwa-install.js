// pwa-install.js — Gestion de l'installation PWA (Windows/Android/iOS)
// ---------------------------------------------------------------------------
// Capture l'événement `beforeinstallprompt` (Chrome/Edge/Android) pour afficher
// un bouton "Installer l'application" dans la sidebar. Sur iOS (Safari), cet
// événement n'existe pas — l'utilisateur doit passer par Partager → Sur l'écran
// d'accueil. On détecte iOS standalone et on guide l'utilisateur via un toast.
//
// Référence UX : Chrome requiere `display: standalone` + icônes 192/512 + un SW
// enregistré + manifest valide avant de déclencher `beforeinstallprompt`. Tous
// ces prérequis sont désormais en place côté manifest/sw.js.

const INSTALL_DISMISSED_KEY = 'rdg_pwa_install_dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours avant de reparaitre

let deferredInstallPrompt = null;

/**
 * Initialise l'écoute de l'événement `beforeinstallprompt`.
 * À appeler une seule fois au bootstrap (app.js).
 */
export function initPWAInstall() {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari ne comprend pas display-mode: standalone à 100%
    (window.navigator.standalone === true);

  // 1. Si déjà installée (standalone), on ne montre jamais le bouton
  if (isStandalone) {
    return;
  }

  // 2. Capturer l'événement différé d'installation (Chrome/Edge/Android)
  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher le mini-infobar automatique de Chrome (moins intrusif)
    e.preventDefault();
    deferredInstallPrompt = e;
    // Ne reproposer que si l'utilisateur n'a pas "refusé" récemment
    if (!isRecentlyDismissed()) {
      showInstallButton();
    }
  });

  // 3. Nettoyer après installation effective
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallButton();
    // Toast de confirmation
    const evt = new CustomEvent('rdg-toast', {
      detail: { message: 'RDGESTION installée avec succès !', type: 'success' }
    });
    window.dispatchEvent(evt);
  });

  // 4. Détection iOS : afficher un guide la 1re fois ( sajout à l'écran d'accueil manuel)
  detectIOSStandalone();
}

/**
 * Affiche le bouton "Installer" dans la sidebar.
 * Insère le markup SANS toucher au style existant (les classes .sidebar-link
 * et .btn sont déjà définies dans style.css).
 */
function showInstallButton() {
  if (document.getElementById('pwa-install-btn')) return; // déjà injecté

  // Injecter le CSS minimal du bouton (inline, dans un <style> nommé)
  if (!document.getElementById('pwa-install-style')) {
    const style = document.createElement('style');
    style.id = 'pwa-install-style';
    style.textContent = `
      #pwa-install-banner { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-secondary, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.12); max-width: 92vw; }
      @media (prefers-color-scheme: dark) { #pwa-install-banner { background: #18181b; border-color: #27272a; } }
      #pwa-install-banner .pwa-icon { width: 36px; height: 36px; border-radius: 8px; background: #09090b; display: flex; align-items: center; justify-content: center; color: #f4f4f5; font-weight: 700; font-size: 14px; flex-shrink: 0; }
      #pwa-install-banner .pwa-text { display: flex; flex-direction: column; }
      #pwa-install-banner .pwa-text strong { font-size: 14px; }
      #pwa-install-banner .pwa-text span { font-size: 12px; color: var(--text-secondary, #6b7280); }
      #pwa-install-banner .pwa-btn-install { padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; border: none; cursor: pointer; background: var(--accent-color, #047857); color: white; }
      #pwa-install-banner .pwa-btn-dismiss { padding: 8px; background: transparent; border: none; cursor: pointer; color: var(--text-secondary, #6b7280); font-size: 18px; line-height: 1; }
    `;
    document.head.appendChild(style);
  }

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-icon">RD</div>
    <div class="pwa-text">
      <strong>Installer RDGESTION</strong>
      <span>Accès rapide depuis votre écran d'accueil</span>
    </div>
    <button class="pwa-btn-install" id="pwa-install-confirm">Installer</button>
    <button class="pwa-btn-dismiss" id="pwa-install-dismiss" aria-label="Fermer">×</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwa-install-confirm').addEventListener('click', triggerInstall);
  document.getElementById('pwa-install-dismiss').addEventListener('click', dismissInstall);
}

function hideInstallButton() {
  const b = document.getElementById('pwa-install-banner');
  if (b) b.remove();
}

/**
 * Déclenche le prompt d'installation natif (Chrome/Edge/Android).
 */
async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'dismissed') {
    // L'utilisateur a refusé le prompt natif → marquer comme dismissed (7j)
    rememberDismissed();
  }
  deferredInstallPrompt = null;
  hideInstallButton();
}

/**
 * L'utilisateur ferme le banner sans installer → on retient le refus 7 jours
 * pour ne pas spammer. Pas de TTL côté auto si l'event re-firme.
 */
function dismissInstall() {
  rememberDismissed();
  hideInstallButton();
}

function rememberDismissed() {
  const data = { at: Date.now() };
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, JSON.stringify(data));
  } catch (_) { /* localStorage indisponible — on ignore benignement */ }
}

function isRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!raw) return false;
    const { at } = JSON.parse(raw);
    return typeof at === 'number' && (Date.now() - at) < DISMISS_TTL_MS;
  } catch (_) {
    return false;
  }
}

/**
 * Détection iOS : si l'utilisateur est sur Safari iOS et n'est PAS en mode
 * standalone (pas encore installé), on toast une seule fois par session pour
 * guider vers "Partager → Sur l'écran d'accueil".
 */
function detectIOSStandalone() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (!isIOS || isStandalone) return;

  // S'assurer qu'on ne toast qu'une fois par session (sessionStorage)
  try {
    if (sessionStorage.getItem('rdg_ios_guide_shown')) return;
    sessionStorage.setItem('rdg_ios_guide_shown', '1');
  } catch (_) { /* sessionStorage indispo */ }

  // Déléguer l'affichage à ui.js Toast via un event custom
  const evt = new CustomEvent('rdg-toast', {
    detail: {
      message: 'Installez RDGESTION : Safari → Partager (⬆︎) → "Sur l\\'écran d\\'accueil" 📲',
      // 8 secondes au lieu du défaut pour laisser le temps de lire l'instruction
      duration: 8000
    }
  });
  // Légère attente pour que Toast soit prêt (en cas de race avec le bootstrap)
  setTimeout(() => window.dispatchEvent(evt), 1200);
}
