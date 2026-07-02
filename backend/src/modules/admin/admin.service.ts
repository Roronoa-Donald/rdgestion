import { query, transaction } from '../../config/database';
import { Subscription, SubscriptionTier, SubscriptionStatus } from '../../types/models';

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
    activatedByUserId: string,
    clientIp: string,
    userAgent: string
  ): Promise<Subscription> {
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
         VALUES ($1, 'PRO', $2, 'ACTIVE', $3, $4, $5, 'MANUAL')
         RETURNING *`,
        [tenantId, billing_type, startDate, endDate, activatedByUserId]
      );
      const sub = res.rows[0]!;

      // Notification à la boutique
      await client.query(
        `INSERT INTO notifications (tenant_id, type, title, message)
         VALUES ($1, 'SUBSCRIPTION_ACTIVATED', 'Abonnement PRO activé ! 🎉', $2)`,
        [tenantId, `Votre boutique est maintenant abonnée au plan PRO (${billing_type === 'MONTHLY' ? 'mensuel' : 'à vie'}). Profitez de toutes les fonctionnalités !`]
      );

      // Log d'audit
      const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [activatedByUserId]);
      const user = userRes.rows[0];
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION', $5, $6, $7, $8)`,
        [tenantId, activatedByUserId, user?.username || null, user?.role || null, sub.id,
          JSON.stringify({ billing_type, end_date: endDate }), clientIp, userAgent]
      );

      return sub;
    });
  }

  /**
   * Vérifie et expire les abonnements dépassés (à appeler en CRON ou à chaque requête).
   */
  async checkAndExpireSubscriptions(): Promise<void> {
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
}

export const adminService = new AdminService();
