export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

// === Devise (currency) =====================================================
// Cache de la devise du tenant, initialise une fois au demarrage via
// initCurrency() a partir du profil renvoye par /api/settings/profile.
// Toutes les vues doivent afficher les montants via formatMoney() au lieu
// de coder 'FCFA' en dur (AGENTS.md : lire settings.currency via formatMoney()).
const CACHED_CURRENCY = { value: null };

/**
 * Initialise le cache de devise a partir du profil/settings du tenant.
 * @param {{currency?: string}=} settings - objet profil contenant `currency`.
 */
export async function initCurrency(settings) {
  CACHED_CURRENCY.value = settings?.currency || 'FCFA';
}

/**
 * Formate un montant avec la devise du tenant (ou une devise explicite).
 * @param {number|string} amount - montant a formater
 * @param {string=} currency - devise explicite (surcharge le cache)
 * @returns {string} ex. "1 250 FCFA"
 */
export function formatMoney(amount, currency) {
  const c = currency || CACHED_CURRENCY.value || 'FCFA';
  return `${Number(amount || 0).toLocaleString('fr-FR')} ${c}`;
}

/**
 * Retourne la devise courante du tenant (par defaut 'FCFA' tant que
 * initCurrency() n'a pas ete appele).
 * @returns {string}
 */
export function getCurrency() {
  return CACHED_CURRENCY.value || 'FCFA';
}
