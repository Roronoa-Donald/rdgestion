import { query, transaction } from '../../config/database';
import { Subscription, SubscriptionTier, SubscriptionStatus, ActivationMethod } from '../../types/models';

export class SubscriptionsService {
  /**
   * Récupère l'abonnement actuel d'une boutique.
   */
  async getCurrentSubscription(tenantId: string): Promise<Subscription | null> {
    const res = await query<Subscription>(
      `SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY start_date DESC LIMIT 1`,
      [tenantId]
    );
    return res.rows[0] || null;
  }

  /**
   * Active manuellement un abonnement PRO (par le SUPERADMIN).
   */
  async activatePro(
    tenantId: string,
    billing_type: 'MONTHLY' | 'LIFETIME',
    activatedByUserId: string | null,
    clientIp: string,
    userAgent: string,
    activation_method: ActivationMethod = 'MANUAL'
  ): Promise<Subscription> {
    // Le sentinel '00000000-0000-0000-0000-000000000000' n'existe pas dans la table users.
    // Les colonnes activated_by (subscriptions) et user_id (audit_logs) acceptent NULL,
    // donc on convertit ce sentinel en NULL pour éviter une violation de FK.
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    const effectiveUserId = (activatedByUserId && activatedByUserId !== SYSTEM_USER_ID)
      ? activatedByUserId
      : null;

    // Calculer la date de fin selon le type de facturation
    const startDate = new Date();
    let endDate: Date | null = null;

    if (billing_type === 'MONTHLY') {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    }
    // LIFETIME → endDate = null (illimité)

    return transaction(async (client) => {
      // Désactiver l'abonnement actuel
      await client.query(
        `UPDATE subscriptions SET status = 'EXPIRED' WHERE tenant_id = $1 AND status = 'ACTIVE'`,
        [tenantId]
      );

      // Créer le nouvel abonnement PRO
      const res = await client.query<Subscription>(
        `INSERT INTO subscriptions (tenant_id, tier, billing_type, status, start_date, end_date, activated_by, activation_method)
         VALUES ($1, 'PRO', $2, 'ACTIVE', $3, $4, $5, $6)
         RETURNING *`,
        [tenantId, billing_type, startDate, endDate, effectiveUserId, activation_method]
      );
      const sub = res.rows[0]!;

      // Notification à la boutique
      await client.query(
        `INSERT INTO notifications (tenant_id, type, title, message)
         VALUES ($1, 'SUBSCRIPTION_ACTIVATED', 'Abonnement PRO activé ! 🎉', $2)`,
        [tenantId, `Votre boutique est maintenant abonnée au plan PRO (${billing_type === 'MONTHLY' ? 'mensuel' : 'à vie'}). Profitez de toutes les fonctionnalités !`]
      );

      // Log d'audit — user_id accepte NULL, ne pas faire de SELECT si pas d'utilisateur
      let user: { username: string; role: string } | null = null;
      if (effectiveUserId) {
        const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [effectiveUserId]);
        user = userRes.rows[0] || null;
      }
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION', $5, $6, $7, $8)`,
        [tenantId, effectiveUserId, user?.username || null, user?.role || null, sub.id,
          JSON.stringify({ billing_type, end_date: endDate }), clientIp, userAgent]
      );

      // ─── Récompense parrainage ──────────────────────────────
      // Chercher un referral PENDING pour le filleul qu'on vient d'activer
      const referralRes = await client.query<{ id: string; referrer_tenant_id: string; status: string }>(
        `SELECT id, referrer_tenant_id, status FROM referrals WHERE referred_tenant_id = $1 FOR UPDATE`,
        [tenantId]
      );
      const referral = referralRes.rows[0];

      if (referral && referral.status === 'PENDING') {
        // Passage PENDING → COMPLETED
        await client.query(
          `UPDATE referrals SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [referral.id]
        );

        // Récupérer le nom de la boutique filleule pour le message
        const filleuleRes = await client.query<{ name: string }>(`SELECT name FROM tenants WHERE id = $1`, [tenantId]);
        const filleuleName = filleuleRes.rows[0]?.name || 'Votre filleul';

        // Audit log REFERRAL_COMPLETED (entité TENANT, entity_id = referral id)
        await client.query(
          `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, 'REFERRAL_COMPLETED', 'TENANT', $5, $6, $7, $8)`,
          [
            referral.referrer_tenant_id, null, null, null, referral.id,
            JSON.stringify({ referred_tenant_id: tenantId, referrer_tenant_id: referral.referrer_tenant_id }),
            clientIp, userAgent
          ]
        );

        // Notification au parrain
        await client.query(
          `INSERT INTO notifications (tenant_id, type, title, message, data)
           VALUES ($1, 'REFERRAL_COMPLETED', $2, $3, $4)`,
          [
            referral.referrer_tenant_id,
            'Filleul passé PRO 🎉',
            `Votre filleul « ${filleuleName} » est passé PRO. Continuez à parrainer pour gagner 1 mois PRO gratuit dès 2 filleuls.`,
            JSON.stringify({ referred_tenant_id: tenantId, referral_id: referral.id })
          ]
        );

        // Compter les referrals COMPLETED non récompensés du parrain (max 2)
        const completedRes = await client.query<{ id: string }>(
          `SELECT id FROM referrals
           WHERE referrer_tenant_id = $1 AND status IN ('COMPLETED', 'REWARDED') AND rewarded_at IS NULL
           ORDER BY completed_at ASC LIMIT 2`,
          [referral.referrer_tenant_id]
        );

        if (completedRes.rows.length >= 2) {
          const rewardedIds = completedRes.rows.map(r => r.id);
          const parrainSubRes = await client.query<{ id: string; billing_type: string | null }>(
            `SELECT id, billing_type FROM subscriptions WHERE tenant_id = $1 AND tier = 'PRO' AND status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1`,
            [referral.referrer_tenant_id]
          );
          const parrainSub = parrainSubRes.rows[0];

          if (parrainSub) {
            const isMonthly = parrainSub.billing_type === 'MONTHLY';
            if (isMonthly) {
              await client.query(
                `UPDATE subscriptions SET end_date = end_date + INTERVAL '30 days', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [parrainSub.id]
              );
            }

            // Marquer les 2 referrals comme REWARDED
            await client.query(
              `UPDATE referrals SET status = 'REWARDED', rewarded_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])`,
              [rewardedIds]
            );

            // Audit log REFERRAL_REWARD_GRANTED
            await client.query(
              `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
               VALUES ($1, $2, $3, $4, 'REFERRAL_REWARD_GRANTED', 'TENANT', $5, $6, $7, $8)`,
              [
                referral.referrer_tenant_id, null, null, null, referral.id,
                JSON.stringify({
                  referrer_tenant_id: referral.referrer_tenant_id,
                  rewarded_referral_ids: rewardedIds,
                  days_granted: isMonthly ? 30 : 0
                }),
                clientIp, userAgent
              ]
            );

            // Notification au parrain
            await client.query(
              `INSERT INTO notifications (tenant_id, type, title, message, data)
               VALUES ($1, 'REFERRAL_REWARD', $2, $3, $4)`,
              [
                referral.referrer_tenant_id,
                isMonthly ? '1 mois PRO gratuit crédité 🎁' : 'Récompense de parrainage attribuée 🎁',
                isMonthly
                  ? "Vous avez reçu 1 mois PRO gratuit grâce à 2 filleuls passés PRO. Merci de recommander RDGESTION !"
                  : "Vous avez atteint 2 filleuls passés PRO. Merci de recommander RDGESTION !",
                JSON.stringify({ rewarded_referral_ids: rewardedIds, days_granted: isMonthly ? 30 : 0 })
              ]
            );
          }
        }
      }

      return sub;
    });
  }

  /**
   * Vérifie et expire les abonnements dépassés (à appeler en CRON ou à chaque requête).
   * Retourne le nombre d'abonnements expirés.
   */
  async checkAndExpireSubscriptions(): Promise<number> {
    // Récupérer les abonnements PRO MONTHLY qui ont dépassé leur date de fin
    const expiredRes = await query<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id FROM subscriptions 
       WHERE tier = 'PRO' AND status = 'ACTIVE' AND billing_type = 'MONTHLY' AND end_date < CURRENT_TIMESTAMP`
    );

    for (const sub of expiredRes.rows) {
      await transaction(async (client) => {
        // Marquer comme expiré
        await client.query(
          `UPDATE subscriptions SET status = 'EXPIRED' WHERE id = $1`,
          [sub.id]
        );

        // Créer un abonnement FREE de remplacement
        await client.query(
          `INSERT INTO subscriptions (tenant_id, tier, status, activation_method) VALUES ($1, 'FREE', 'ACTIVE', 'AUTO')`,
          [sub.tenant_id]
        );

        // Notifier la boutique
        await client.query(
          `INSERT INTO notifications (tenant_id, type, title, message)
           VALUES ($1, 'SUBSCRIPTION_EXPIRED', $2, $3)`,
          [
            sub.tenant_id,
            'Votre abonnement PRO a expiré',
            'Votre abonnement PRO a expiré. Vous êtes maintenant sur le plan Gratuit. Renouvelez pour conserver l\'accès aux fonctionnalités premium.'
          ]
        );
      });
    }

    return expiredRes.rows.length;
  }

  /**
   * Envoie des notifications J-7, J-3, J-1 avant l'expiration d'un abonnement PRO MONTHLY.
   * Idempotent via vérification d'existence d'une notification émise dans les dernières 24h.
   */
  async notifySubscriptionsExpiringSoon(): Promise<number> {
    let sentCount = 0;
    const daysBeforeList = [7, 3, 1];

    for (const daysBefore of daysBeforeList) {
      // Abonnements PRO MONTHLY actifs avec end_date dans exactement N jours (fenêtre ±12h)
      const subsRes = await query<{ id: string; tenant_id: string; end_date: Date }>(
        `SELECT id, tenant_id, end_date FROM subscriptions
         WHERE tier = 'PRO' AND status = 'ACTIVE' AND billing_type = 'MONTHLY'
           AND end_date IS NOT NULL
           AND end_date BETWEEN CURRENT_TIMESTAMP + ($1 || ' days')::interval - INTERVAL '12 hours'
                            AND CURRENT_TIMESTAMP + ($1 || ' days')::interval + INTERVAL '12 hours'`,
        [String(daysBefore)]
      );

      for (const sub of subsRes.rows) {
        // Idempotence : vérifier existence d'une notification SUBSCRIPTION_EXPIRING avec le même days_before dans les dernières 24h
        const existingRes = await query<{ id: string }>(
          `SELECT id FROM notifications
           WHERE tenant_id = $1 AND type = 'SUBSCRIPTION_EXPIRING'
             AND (data->>'days_before') = $2
             AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
          [sub.tenant_id, String(daysBefore)]
        );
        if (existingRes.rows.length === 0) {
          await query(
            `INSERT INTO notifications (tenant_id, type, title, message, data)
             VALUES ($1, 'SUBSCRIPTION_EXPIRING', $2, $3, $4)`,
            [
              sub.tenant_id,
              'Votre abonnement PRO expire bientôt',
              `Votre abonnement PRO expire dans ${daysBefore} jour${daysBefore > 1 ? 's' : ''}. Renouvelez dès maintenant pour conserver l'accès aux fonctionnalités premium.`,
              JSON.stringify({ days_before: daysBefore, subscription_id: sub.id, end_date: sub.end_date })
            ]
          );
          sentCount++;
        }
      }
    }

    return sentCount;
  }
}

export const subscriptionsService = new SubscriptionsService();

// ============================================================

export class ReferralsService {
  /**
   * Récupère le code de parrainage et les statistiques de parrainage d'une boutique.
   */
  async getReferralInfo(tenantId: string) {
    const tenantRes = await query<{ referral_code: string; name: string }>(
      'SELECT referral_code, name FROM tenants WHERE id = $1',
      [tenantId]
    );
    const tenant = tenantRes.rows[0]!;

    const referralsRes = await query<{
      id: string;
      referred_tenant_name: string;
      status: string;
      created_at: Date;
      completed_at: Date | null;
      rewarded_at: Date | null;
    }>(
      `SELECT r.id, t.name as referred_tenant_name, r.status, r.created_at, r.completed_at, r.rewarded_at
       FROM referrals r
       INNER JOIN tenants t ON r.referred_tenant_id = t.id
       WHERE r.referrer_tenant_id = $1
       ORDER BY r.created_at DESC`,
      [tenantId]
    );

    // Compter les filleuls PRO complétés (pour calcul récompense)
    const completedCount = referralsRes.rows.filter(r => r.status === 'COMPLETED' || r.status === 'REWARDED').length;
    const rewardedCount = referralsRes.rows.filter(r => r.status === 'REWARDED').length;
    const pendingRewards = completedCount - rewardedCount; // Récompenses à donner

    return {
      referral_code: tenant.referral_code,
      shop_name: tenant.name,
      referrals: referralsRes.rows,
      stats: {
        total: referralsRes.rows.length,
        pending: referralsRes.rows.filter(r => r.status === 'PENDING').length,
        completed: completedCount,
        pending_rewards: pendingRewards
      }
    };
  }
}

export const referralsService = new ReferralsService();

// ============================================================

export class AdminService {
  /**
   * Liste toutes les boutiques (SUPERADMIN).
   */
  async listTenants(filters: { page?: number; limit?: number; search?: string; status?: 'active' | 'inactive' }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const params: any[] = [limit, offset];
    let q = `
      SELECT t.*, 
             s.tier as subscription_tier, 
             s.status as subscription_status,
             s.end_date as subscription_end_date,
             (SELECT COUNT(id) FROM users WHERE tenant_id = t.id AND role != 'SUPERADMIN') as user_count
      FROM tenants t
      LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'ACTIVE'
      WHERE 1=1
    `;

    let idx = 3;
    if (filters.search) {
      q += ` AND (t.name ILIKE $${idx} OR t.phone ILIKE $${idx} OR t.owner_name ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }
    if (filters.status) {
      q += ` AND t.is_active = $${idx++}`;
      params.push(filters.status === 'active');
    }

    q += ` ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`;

    const res = await query(q, params);

    const countParams: any[] = [];
    let countQuery = 'SELECT COUNT(id) FROM tenants WHERE 1=1';
    let countIdx = 1;

    if (filters.search) {
      countQuery += ` AND (name ILIKE $${countIdx} OR phone ILIKE $${countIdx} OR owner_name ILIKE $${countIdx})`;
      countParams.push(`%${filters.search}%`);
      countIdx++;
    }
    if (filters.status) {
      countQuery += ` AND is_active = $${countIdx++}`;
      countParams.push(filters.status === 'active');
    }

    const countRes = await query<{ count: string }>(countQuery, countParams);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    return {
      tenants: res.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  /**
   * Active ou désactive une boutique (SUPERADMIN).
   */
  async toggleTenantStatus(tenantId: string, isActive: boolean, adminId: string, clientIp: string, userAgent: string) {
    const res = await query<{ id: string; name: string }>(
      `UPDATE tenants SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name`,
      [isActive, tenantId]
    );
    const tenant = res.rows[0];
    if (!tenant) {
      const err = new Error('Boutique introuvable.');
      (err as any).statusCode = 404;
      throw err;
    }

    const action = isActive ? 'USER_ENABLED' : 'USER_DISABLED';
    const adminRes = await query<{ username: string }>('SELECT username FROM users WHERE id = $1', [adminId]);
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, 'SUPERADMIN', $4, 'TENANT', $1, $5, $6, $7)`,
      [tenantId, adminId, adminRes.rows[0]?.username || null, action, JSON.stringify({ is_active: isActive }), clientIp, userAgent]
    );

    return tenant;
  }

  /**
   * Statistiques globales de la plateforme (SUPERADMIN).
   * Exclut le tenant système (id = '00000000-0000-0000-0000-000000000000').
   */
  async getPlatformStats() {
    const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

    const tenantsRes = await query<{ count: string }>(
      `SELECT COUNT(id) AS count FROM tenants WHERE id != $1`,
      [SYSTEM_TENANT_ID]
    );
    const total_tenants = parseInt(tenantsRes.rows[0]?.count || '0', 10);

    const active7dRes = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT t.id) AS count
       FROM tenants t
       WHERE t.id != $1
         AND EXISTS (
           SELECT 1 FROM sales s WHERE s.tenant_id = t.id AND s.created_at > NOW() - INTERVAL '7 days'
         )`,
      [SYSTEM_TENANT_ID]
    );
    const active_tenants_7d = parseInt(active7dRes.rows[0]?.count || '0', 10);

    const freeRes = await query<{ count: string }>(
      `SELECT COUNT(id) AS count FROM subscriptions WHERE tier = 'FREE' AND status = 'ACTIVE'`
    );
    const free_count = parseInt(freeRes.rows[0]?.count || '0', 10);

    const proRes = await query<{ count: string }>(
      `SELECT COUNT(id) AS count FROM subscriptions WHERE tier = 'PRO' AND status = 'ACTIVE'`
    );
    const pro_count = parseInt(proRes.rows[0]?.count || '0', 10);

    const proMonthlyRes = await query<{ count: string }>(
      `SELECT COUNT(id) AS count FROM subscriptions WHERE tier = 'PRO' AND status = 'ACTIVE' AND billing_type = 'MONTHLY'`
    );
    const pro_monthly_count = parseInt(proMonthlyRes.rows[0]?.count || '0', 10);

    const proLifetimeRes = await query<{ count: string }>(
      `SELECT COUNT(id) AS count FROM subscriptions WHERE tier = 'PRO' AND status = 'ACTIVE' AND billing_type = 'LIFETIME'`
    );
    const pro_lifetime_count = parseInt(proLifetimeRes.rows[0]?.count || '0', 10);

    // Revenu mensuel estimé : en l'absence d'historique de paiements, on calcule
    // pro_monthly_count * 5000 (tarif mensuel PRO) + pro_lifetime_count * 0 (payé une fois).
    // À remplacer par une vraie table de paiements quand elle existera.
    const monthly_revenue = pro_monthly_count * 5000;

    const salesRes = await query<{ count: string }>(
      `SELECT COUNT(id) AS count FROM sales WHERE is_cancelled = false`
    );
    const total_sales = parseInt(salesRes.rows[0]?.count || '0', 10);

    const revenueRes = await query<{ sum: string | null }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS sum FROM sales WHERE is_cancelled = false`
    );
    const total_revenue_all_tenants = parseFloat(revenueRes.rows[0]?.sum || '0');

    return {
      total_tenants,
      active_tenants_7d,
      free_count,
      pro_count,
      pro_monthly_count,
      pro_lifetime_count,
      monthly_revenue,
      total_sales,
      total_revenue_all_tenants
    };
  }

  /**
   * Détail d'une boutique (SUPERADMIN) : infos tenant + abonnement + agrégats.
   */
  async getTenantDetail(tenantId: string) {
    const tenantRes = await query<{
      id: string; name: string; owner_name: string; phone: string; email: string | null;
      address: string | null; city: string | null; country: string | null; currency: string;
      logo_url: string | null; slogan: string | null; tax_number: string | null;
      referral_code: string; is_active: boolean; onboarding_completed: boolean;
      created_at: Date; updated_at: Date;
      subscription_tier: string | null; subscription_status: string | null;
      subscription_billing_type: string | null; subscription_start_date: Date | null;
      subscription_end_date: Date | null;
    }>(
      `SELECT t.*, s.tier AS subscription_tier, s.status AS subscription_status,
              s.billing_type AS subscription_billing_type, s.start_date AS subscription_start_date,
              s.end_date AS subscription_end_date
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'ACTIVE'
       WHERE t.id = $1`,
      [tenantId]
    );
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      const err = new Error('Boutique introuvable.');
      (err as any).statusCode = 404;
      (err as any).code = 'TENANT_NOT_FOUND';
      throw err;
    }

    const usersRes = await query<{ role: string; count: string }>(
      `SELECT role, COUNT(id) AS count FROM users WHERE tenant_id = $1 GROUP BY role`,
      [tenantId]
    );
    const users_by_role: Record<string, number> = {};
    let total_users = 0;
    for (const row of usersRes.rows) {
      users_by_role[row.role] = parseInt(row.count, 10);
      total_users += parseInt(row.count, 10);
    }

    const productsRes = await query<{ count: string }>(
      `SELECT COUNT(id) AS count FROM products WHERE tenant_id = $1 AND is_deleted = false`,
      [tenantId]
    );
    const total_products = parseInt(productsRes.rows[0]?.count || '0', 10);

    const salesRes = await query<{ count: string; total_revenue: string | null; last_sale: Date | null }>(
      `SELECT COUNT(id) AS count,
              COALESCE(SUM(total_amount) FILTER (WHERE is_cancelled = false), 0) AS total_revenue,
              MAX(created_at) AS last_sale
       FROM sales WHERE tenant_id = $1`,
      [tenantId]
    );
    const salesRow = salesRes.rows[0];
    const total_sales = parseInt(salesRow?.count || '0', 10);
    const total_revenue = parseFloat(salesRow?.total_revenue || '0');
    const last_sale_date = salesRow?.last_sale || null;

    return {
      tenant,
      subscription: {
        tier: tenant.subscription_tier,
        status: tenant.subscription_status,
        billing_type: tenant.subscription_billing_type,
        start_date: tenant.subscription_start_date,
        end_date: tenant.subscription_end_date
      },
      stats: {
        total_users,
        users_by_role,
        total_products,
        total_sales,
        total_revenue,
        last_sale_date
      }
    };
  }
}

export const adminService = new AdminService();
