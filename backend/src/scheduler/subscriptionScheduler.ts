import { subscriptionsService } from '../modules/admin/admin.service';

let schedulerHandle: NodeJS.Timeout | null = null;
let initialRunHandle: NodeJS.Timeout | null = null;

/**
 * Exécute le job d'expiration des abonnements :
 *  - Notifications J-7 / J-3 / J-1 (idempotentes)
 *  - Expiration des abonnements PRO MONTHLY dépassés
 * Réutilisable par l'endpoint cron HTTP.
 */
export async function runSubscriptionExpirationJob(): Promise<{ expired_count: number }> {
  await subscriptionsService.notifySubscriptionsExpiringSoon();
  const expired_count = await subscriptionsService.checkAndExpireSubscriptions();
  return { expired_count };
}

/**
 * Démarre le scheduler d'expiration des abonnements.
 * - Sur Vercel (serverless) : n◦ de setInterval, return immédiat (l'endpoint cron HTTP prend le relais).
 * - En local / Docker : setInterval toutes les heures + appel initial 5s après le boot.
 */
export function startSubscriptionScheduler(): void {
  const run = async () => {
    try {
      const result = await runSubscriptionExpirationJob();
      console.log(`[SubscriptionScheduler] Job terminé — abonnements expirés : ${result.expired_count}`);
    } catch (err) {
      console.error('[SubscriptionScheduler] Erreur lors de l\'exécution du job :', (err as Error).message);
    }
  };

  if (process.env.VERCEL) {
    console.log('ℹ️ [SubscriptionScheduler] Environnement Vercel détecté : scheduler désactivé (serverless). Utilisez l\'endpoint cron HTTP.');
    return;
  }

  // Appel initial 5s après le boot (laisse le temps aux autres sous-systèmes de s'initialiser)
  initialRunHandle = setTimeout(run, 5000);

  // Puis toutes les heures
  schedulerHandle = setInterval(run, 60 * 60 * 1000);

  console.log('✅ [SubscriptionScheduler] Scheduler démarré (intervalle : 1 heure).');
}

/**
 * Arrête proprement le scheduler (utile pour les tests / shutdown propre).
 */
export function stopSubscriptionScheduler(): void {
  if (initialRunHandle) {
    clearTimeout(initialRunHandle);
    initialRunHandle = null;
  }
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
