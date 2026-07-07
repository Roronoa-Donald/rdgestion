import { query } from '../../config/database';

export class DashboardService {
  /**
   * Calcule les statistiques du tableau de bord d'une boutique.
   */
  async getStats(tenantId: string) {
    // Ventes du jour (non annulées) — timezone Africa/Lome
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
         AND created_at::date = timezone('Africa/Lome', NOW())::date`,
      [tenantId]
    );
    const todaySales = todaySalesRes.rows[0]!;

    // Ventes du jour précédent (pour calcul de tendance) — timezone Africa/Lome
    const yesterdaySalesRes = await query<{ total_amount: string }>(
      `SELECT COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales
       WHERE tenant_id = $1 
         AND is_cancelled = FALSE
         AND created_at::date = (timezone('Africa/Lome', NOW()) - interval '1 day')::date`,
      [tenantId]
    );
    const yesterdayTotal = Number(yesterdaySalesRes.rows[0]?.total_amount ?? 0);
    const todayTotal = Number(todaySales.total_amount);
    const revenueTrend = yesterdayTotal > 0
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
      : 0;

    // C3. cancelled_count du jour (is_cancelled = TRUE) — timezone Africa/Lome
    const cancelledRes = await query<{ cancelled_count: string }>(
      `SELECT COUNT(id) as cancelled_count
       FROM sales
       WHERE tenant_id = $1
         AND is_cancelled = TRUE
         AND created_at::date = timezone('Africa/Lome', NOW())::date`,
      [tenantId]
    );
    const cancelledCount = parseInt(cancelledRes.rows[0]?.cancelled_count ?? '0', 10);

    // Ventes des 30 derniers jours (graphique) — timezone Africa/Lome
    const last30DaysRes = await query<{ day: string; sale_count: string; total_amount: string }>(
      `SELECT 
         to_char(created_at::date, 'YYYY-MM-DD') as day,
         COUNT(id) as sale_count,
         COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales
       WHERE tenant_id = $1
         AND is_cancelled = FALSE
         AND created_at >= timezone('Africa/Lome', NOW()) - interval '30 days'
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

    // C2. chart_data — weekly (12 dernières semaines, week_start = lundi)
    const weeklyRes = await query<{ week_start: string; revenue: string; count: string }>(
      `SELECT 
         to_char(date_trunc('week', created_at::date), 'YYYY-MM-DD') as week_start,
         COALESCE(SUM(total_amount), 0) as revenue,
         COUNT(id) as count
       FROM sales
       WHERE tenant_id = $1
         AND is_cancelled = FALSE
         AND created_at::date >= (timezone('Africa/Lome', NOW())::date - ((12 - 1) * 7))::date
       GROUP BY date_trunc('week', created_at::date)
       ORDER BY week_start ASC`,
      [tenantId]
    );

    // C2. chart_data — monthly (12 derniers mois)
    const monthlyRes = await query<{ month: string; revenue: string; count: string }>(
      `SELECT 
         to_char(date_trunc('month', created_at::date), 'YYYY-MM') as month,
         COALESCE(SUM(total_amount), 0) as revenue,
         COUNT(id) as count
       FROM sales
       WHERE tenant_id = $1
         AND is_cancelled = FALSE
         AND created_at::date >= date_trunc('month', (timezone('Africa/Lome', NOW()) - interval '11 months')::date)
       GROUP BY date_trunc('month', created_at::date)
       ORDER BY month ASC`,
      [tenantId]
    );

    // C2. chart_data — yearly (5 dernières années)
    const yearlyRes = await query<{ year: number; revenue: string; count: string }>(
      `SELECT 
         EXTRACT(YEAR FROM created_at)::int as year,
         COALESCE(SUM(total_amount), 0) as revenue,
         COUNT(id) as count
       FROM sales
       WHERE tenant_id = $1
         AND is_cancelled = FALSE
         AND created_at::date >= date_trunc('year', (timezone('Africa/Lome', NOW()) - interval '4 years')::date)
       GROUP BY EXTRACT(YEAR FROM created_at)
       ORDER BY year ASC`,
      [tenantId]
    );

    // C4. stock_alerts détaillé
    const stockAlertsRes = await query<{
      product_id: string;
      name: string;
      stock_quantity: string;
      threshold: string;
      is_out: boolean;
    }>(
      `SELECT 
         p.id as product_id,
         p.name,
         p.stock_quantity::text,
         COALESCE(p.stock_threshold, s.global_stock_threshold, 20) as threshold,
         (p.stock_quantity = 0) as is_out
       FROM products p
       LEFT JOIN settings s ON s.tenant_id = p.tenant_id
       WHERE p.tenant_id = $1
         AND p.is_deleted = FALSE
         AND p.stock_quantity <= COALESCE(p.stock_threshold, COALESCE(s.global_stock_threshold, 20))
       ORDER BY p.stock_quantity ASC, p.name ASC`,
      [tenantId]
    );

    // C5. category_sales — histogramme ventes par catégorie (mois en cours)
    const categorySalesRes = await query<{
      category_name: string;
      total_revenue: string;
      total_count: string;
    }>(
      `SELECT 
         COALESCE(c.name, 'Sans catégorie') as category_name,
         COALESCE(SUM(si.total_price), 0)::text as total_revenue,
         COUNT(DISTINCT s.id)::text as total_count
       FROM sale_items si
       INNER JOIN sales s ON si.sale_id = s.id
       LEFT JOIN products p ON si.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE s.tenant_id = $1
         AND s.is_cancelled = FALSE
         AND s.created_at >= date_trunc('month', timezone('Africa/Lome', NOW())::date)
       GROUP BY COALESCE(c.name, 'Sans catégorie')
       ORDER BY total_revenue DESC`,
      [tenantId]
    );

    return {
      today: {
        sale_count: parseInt(todaySales.sale_count, 10),
        revenue: parseFloat(todaySales.total_amount),
        profit: parseFloat(todaySales.profit_estimate),
        revenue_trend_percent: Math.round(revenueTrend * 100) / 100,
        cancelled_count: cancelledCount,
        daily_limit_count: dailySalesCount,
        daily_limit_max: subscription?.tier === 'FREE' ? 30 : null
      },
      products: {
        total: parseInt(productsStats.total, 10),
        low_stock_count: parseInt(productsStats.low_stock, 10),
        low_stock: parseInt(productsStats.low_stock, 10)
      },
      stock_alerts: stockAlertsRes.rows.map((r) => ({
        product_id: r.product_id,
        name: r.name,
        stock_quantity: parseInt(r.stock_quantity, 10),
        threshold: Number(r.threshold),
        is_out: r.is_out
      })),
      top_products: topProductsRes.rows,
      payment_methods: paymentMethodRes.rows,
      chart_last_30_days: last30DaysRes.rows.map((r) => ({
        date: r.day,
        revenue: parseFloat(r.total_amount),
        count: parseInt(r.sale_count, 10)
      })),
      chart_data: {
        daily: last30DaysRes.rows.map((r) => ({
          date: r.day,
          revenue: parseFloat(r.total_amount),
          count: parseInt(r.sale_count, 10)
        })),
        weekly: weeklyRes.rows.map((r) => ({
          week_start: r.week_start,
          revenue: parseFloat(r.revenue),
          count: parseInt(r.count, 10)
        })),
        monthly: monthlyRes.rows.map((r) => ({
          month: r.month,
          revenue: parseFloat(r.revenue),
          count: parseInt(r.count, 10)
        })),
        yearly: yearlyRes.rows.map((r) => ({
          year: r.year,
          revenue: parseFloat(r.revenue),
          count: parseInt(r.count, 10)
        }))
      },
      category_sales: categorySalesRes.rows.map((r) => ({
        category_name: r.category_name,
        total_revenue: parseFloat(r.total_revenue),
        total_count: parseInt(r.total_count, 10)
      })),
      subscription: {
        tier: subscription?.tier ?? 'FREE',
        status: subscription?.status ?? 'ACTIVE',
        end_date: subscription?.end_date ?? null
      }
    };
  }
}

export const dashboardService = new DashboardService();
