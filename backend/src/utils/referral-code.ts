/**
 * Génère un code de parrainage unique pour un commerce.
 * Format: RD-[NOM_BOUTIQUE_NORMALISÉ]-[3_CHIFFRES]
 * 
 * @param shopName Nom brut de la boutique
 */
export function generateReferralCode(shopName: string): string {
  // Normaliser le nom : majuscules, enlever les accents/caractères spéciaux, garder uniquement alphanumérique
  const normalized = shopName
    .normalize('NFD') // Décomposer les accents (ex: é -> e + accent)
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les marques d'accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // Garder seulement les lettres A-Z et chiffres 0-9

  // Tronquer à 10 caractères
  const truncated = normalized.substring(0, 10);

  // Si le nom normalisé est vide (ex: boutique nommée uniquement avec des emojis/caractères spéciaux)
  const base = truncated || 'BOUTIQUE';

  // Générer un nombre aléatoire entre 100 et 999
  const randomNum = Math.floor(Math.random() * 900) + 100;

  return `RD-${base}-${randomNum}`;
}
