import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service';
import * as database from '../../config/database';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  pool: { end: vi.fn() }
}));

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService();
    vi.clearAllMocks();
  });

  it('getStats devrait agréger today + chart_data.daily/weekly/monthly/yearly + stock_alerts + category_sales + cancelled_count', async () => {
    vi.spyOn(database, 'query')
      .mockResolvedValueOnce({ rows: [{ sale_count: '5', total_amount: '125000', profit_estimate: '45000' }] } as any) // today sales
      .mockResolvedValueOnce({ rows: [{ total_amount: '100000' }] } as any) // yesterday trend
      .mockResolvedValueOnce({ rows: [{ cancelled_count: '1' }] } as any) // cancelled today
      .mockResolvedValueOnce({ rows: [{ day: '2026-07-06', sale_count: '5', total_amount: '125000' }] } as any) // 30 days
      .mockResolvedValueOnce({ rows: [{ total: '50', low_stock: '3' }] } as any) // products
      .mockResolvedValueOnce({ rows: [{ product_id: 'p1', product_name: 'Doliprane', total_quantity: '10', total_revenue: '2000' }] } as any) // top products
      .mockResolvedValueOnce({ rows: [{ payment_method: 'CASH', count: '20', total_amount: '5000' }] } as any) // payment methods
      .mockResolvedValueOnce({ rows: [{ count: 5 }] } as any) // daily count
      .mockResolvedValueOnce({ rows: [{ tier: 'PRO', status: 'ACTIVE', end_date: new Date() }] } as any) // sub
      .mockResolvedValueOnce({ rows: [{ week_start: '2026-07-06', revenue: '125000', count: '5' }] } as any) // weekly
      .mockResolvedValueOnce({ rows: [{ month: '2026-07', revenue: '125000', count: '5' }] } as any) // monthly
      .mockResolvedValueOnce({ rows: [{ year: 2026, revenue: '125000', count: '5' }] } as any) // yearly
      .mockResolvedValueOnce({ rows: [{ product_id: 'p1', name: 'Doliprane', stock_quantity: '3', threshold: '20', is_out: false }] } as any) // stock_alerts
      .mockResolvedValueOnce({ rows: [{ category_name: 'Médicaments', total_revenue: '125000', total_count: '5' }] } as any); // category_sales

    const stats = await service.getStats('tenant-1');

    expect(stats.today.sale_count).toBe(5);
    expect(stats.today.revenue).toBe(125000);
    expect(stats.today.cancelled_count).toBe(1);
    expect(stats.today.daily_limit_max).toBeNull();
    expect(stats.chart_data.daily).toHaveLength(1);
    expect(stats.chart_data.weekly).toHaveLength(1);
    expect(stats.chart_data.monthly).toHaveLength(1);
    expect(stats.chart_data.yearly).toHaveLength(1);
    expect(stats.stock_alerts).toHaveLength(1);
    expect(stats.stock_alerts[0]!.product_id).toBe('p1');
    expect(stats.category_sales).toHaveLength(1);
    expect(stats.subscription.tier).toBe('PRO');
  });

  it('getStats FREE devrait définir daily_limit_max à 30', async () => {
    vi.spyOn(database, 'query')
      .mockResolvedValueOnce({ rows: [{ sale_count: '0', total_amount: '0', profit_estimate: '0' }] } as any)
      .mockResolvedValueOnce({ rows: [{ total_amount: '0' }] } as any)
      .mockResolvedValueOnce({ rows: [{ cancelled_count: '0' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ total: '0', low_stock: '0' }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ count: 0 }] } as any)
      .mockResolvedValueOnce({ rows: [{ tier: 'FREE', status: 'ACTIVE', end_date: null }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const stats = await service.getStats('tenant-1');
    expect(stats.subscription.tier).toBe('FREE');
    expect(stats.today.daily_limit_max).toBe(30);
  });
});
