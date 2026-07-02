import { query } from '../../config/database';

export class DashboardService {
  /**
   * Calcule les statistiques du tableau de bord d'une boutique.
   */
  async getStats(tenantId: string) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Ventes du jour (non annulées)
    const todaySalesRes = await query<{
      sale_count: string;
      total_amount: string;
      profit_estimate: string;
    }>(
      `SELECT 
         COUNT(id) as sale_count,
         COALESCE(SUM(total_amount), 0) as total_amount,
         COALESCE(SUM(profit_estimate), 0) as profit_estimate
       FROM sales
       WHERE tenant_id = $1 
         AND is_cancelled = FALSE
         AND created_at::date = CURRENT_DATE`,
      [tenantId]
    );
    const todaySales = todaySalesRes.rows[0]!;

    // Ventes du jour précédent (pour calcul de tendance)
    const yesterdaySalesRes = await query<{ total_amount: string }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales
       WHERE tenant_id = $1 
         AND is_cancelled = FALSE
         AND created_at::date = CURRENT_DATE - INTERVAL '1 day'`,
      [tenantId]
    );
    const yesterdayTotal = Number(yesterdaySalesRes.rows[0]?.total_amount ?? 0);
    const todayTotal = Number(todaySales.total_amount);
    const revenueTrend = yesterdayTotal > 0
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
      : 0;

    // Ventes des 30 derniers jours (graphique)
    const last30DaysRes = await query<{ day: string; sale_count: string; total_amount: string }>(
      `SELECT 
         to_char(created_at::date, 'YYYY-MM-DD') as day,
         COUNT(id) as sale_count,
         COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales
       WHERE tenant_id = $1
         AND is_cancelled = FALSE
         AND created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY created_at::date
       ORDER BY day ASC`,
      [tenantId]
    );

    // Nombre de produits actifs
    const productsCountRes = await query<{ total: string; low_stock: string }>(
      `SELECT 
         COUNT(id) as total,
         COUNT(CASE 
           WHEN stock_quantity <= COALESCE(stock_threshold, (
             SELECT global_stock_threshold FROM settings WHERE tenant_id = $1
           ), 20) THEN 1 
         END) as low_stock
       FROM products
       WHERE tenant_id = $1 AND is_deleted = FALSE`,
      [tenantId]
    );
    const productsStats = productsCountRes.rows[0]!;

    // Top 5 produits les plus vendus (ce mois-ci)
    const topProductsRes = await query<{
      product_id: string;
      product_name: string;
      total_quantity: string;
      total_revenue: string;
    }>(
      `SELECT 
         si.product_id,
         si.product_name,
         SUM(si.quantity) as total_quantity,
         SUM(si.total_price) as total_revenue
       FROM sale_items si
       INNER JOIN sales s ON si.sale_id = s.id
       WHERE s.tenant_id = $1 
         AND s.is_cancelled = FALSE
         AND s.created_at >= date_trunc('month', CURRENT_DATE)
       GROUP BY si.product_id, si.product_name
       ORDER BY total_quantity DESC
       LIMIT 5`,
      [tenantId]
    );

    // Répartition par mode de paiement (mois en cours)
    const paymentMethodRes = await query<{
      payment_method: string;
      count: string;
      total_amount: string;
    }>(
      `SELECT 
         payment_method,
         COUNT(id) as count,
         COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales
       WHERE tenant_id = $1
         AND is_cancelled = FALSE
         AND created_at >= date_trunc('month', CURRENT_DATE)
       GROUP BY payment_method`,
      [tenantId]
    );

    // Compteur journalier + limite plan FREE
    const dailyCountRes = await query<{ count: number }>(
      `SELECT count FROM daily_sale_counts WHERE tenant_id = $1 AND sale_date = CURRENT_DATE`,
      [tenantId]
    );
    const dailySalesCount = dailyCountRes.rows[0]?.count ?? 0;

    // Plan actuel
    const subRes = await query<{ tier: string; status: string; end_date: Date | null }>(
      `SELECT tier, status, end_date FROM subscriptions WHERE tenant_id = $1 AND status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1`,
      [tenantId]
    );
    const subscription = subRes.rows[0];

    return {
      today: {
        sale_count: parseInt(todaySales.sale_count, 10),
        revenue: parseFloat(todaySales.total_amount),
        profit: parseFloat(todaySales.profit_estimate),
        revenue_trend_percent: Math.round(revenueTrend * 100) / 100,
        daily_limit_count: dailySalesCount,
        daily_limit_max: subscription?.tier === 'FREE' ? 30 : null
      },
      products: {
        total: parseInt(productsStats.total, 10),
        low_stock: parseInt(productsStats.low_stock, 10)
      },
      top_products: topProductsRes.rows,
      payment_methods: paymentMethodRes.rows,
      chart_last_30_days: last30DaysRes.rows,
      subscription: {
        tier: subscription?.tier ?? 'FREE',
        status: subscription?.status ?? 'ACTIVE',
        end_date: subscription?.end_date ?? null
      }
    };
  }
}

export const dashboardService = new DashboardService();
