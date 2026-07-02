/**
 * Vérifie si une date donnée est strictement dans le futur.
 */
export function isFutureDate(date: Date | string | number): boolean {
  const d = new Date(date);
  return d.getTime() > Date.now();
}

/**
 * Retourne le début de la journée en cours dans le fuseau horaire donné (ou heure locale).
 * Utile pour réinitialiser le compteur de ventes journalières.
 */
export function getStartOfToday(timezone: string = 'Africa/Lome'): Date {
  const now = new Date();
  // Formater la date actuelle dans la timezone cible sans heure, puis reconstruire le début de la journée
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  if (year && month && day) {
    // Reconstruire une date ISO dans le timezone local
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
  }
  
  // Fallback sur minuit heure machine local
  const localToday = new Date();
  localToday.setHours(0, 0, 0, 0);
  return localToday;
}
