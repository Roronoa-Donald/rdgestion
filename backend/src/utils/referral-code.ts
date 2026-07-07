import { query } from '../config/database';

/**
 * Génère un code de parrainage unique pour un commerce.
 * Format: RD-[NOM_BOUTIQUE_NORMALISÉ]-[3_CHIFFRES]
 * Vérifie l'unicité en base et réessaie jusqu'à 10 fois en cas de collision.
 * 
 * @param shopName Nom brut de la boutique
 */
export async function generateUniqueReferralCode(shopName: string): Promise<string> {
  const normalized = shopName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const truncated = normalized.substring(0, 10);
  const base = truncated || 'BOUTIQUE';

  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const randomNum = Math.floor(Math.random() * 900) + 100;
    const code = `RD-${base}-${randomNum}`;

    const exists = await query('SELECT 1 FROM tenants WHERE referral_code = $1', [code]);
    if (exists?.rowCount === 0) {
      return code;
    }
  }

  throw new Error('Impossible de générer un code de parrainage unique après 10 tentatives. Veuillez réessayer.');
}

/**
 * @deprecated Utiliser generateUniqueReferralCode (version synchrone sans vérification BDD, conservée pour compat).
 */
export function generateReferralCode(shopName: string): string {
  const normalized = shopName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const truncated = normalized.substring(0, 10);
  const base = truncated || 'BOUTIQUE';
  const randomNum = Math.floor(Math.random() * 900) + 100;

  return `RD-${base}-${randomNum}`;
}
