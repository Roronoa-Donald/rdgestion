/**
 * Génère un SKU automatique au format SKU-XXXXXX
 * XXXXXX est composé de 6 caractères alphanumériques aléatoires en majuscules.
 */
export function generateSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    randomPart += chars.charAt(randomIndex);
  }
  return `SKU-${randomPart}`;
}
