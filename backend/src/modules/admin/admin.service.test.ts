import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionsService, ReferralsService } from './admin.service';
import * as database from '../../config/database';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  pool: { end: vi.fn() }
}));

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(() => {
    service = new SubscriptionsService();
    vi.clearAllMocks();
  });

  describe('activatePro', () => {
    it('devrait activer un abonnement PRO sans referral', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }) // expire old subs
          .mockResolvedValueOnce({ rows: [{ id: 'sub-new', tier: 'PRO', billing_type: 'MONTHLY', status: 'ACTIVE' }] }) // insert new sub
          .mockResolvedValueOnce({ rows: [] }) // notification
          .mockResolvedValueOnce({ rows: [{ username: 'superadmin', role: 'SUPERADMIN' }] }) // select admin user
          .mockResolvedValueOnce({ rows: [] }) // audit log
          .mockResolvedValueOnce({ rows: [] }) // referral lookup (none)
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      const sub = await service.activatePro('tenant-1', 'MONTHLY', 'admin-1', '127.0.0.1', 'UA');
      expect(sub.tier).toBe('PRO');
      expect(sub.status).toBe('ACTIVE');
    });

    it('devrait transformer un referral PENDING en COMPLETED (et non récompenser seul)', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'sub-new', tier: 'PRO', billing_type: 'MONTHLY', status: 'ACTIVE' }] })
          .mockResolvedValueOnce({ rows: [] }) // notif activation
          .mockResolvedValueOnce({ rows: [{ username: 'superadmin', role: 'SUPERADMIN' }] })
          .mockResolvedValueOnce({ rows: [] }) // audit
          .mockResolvedValueOnce({ rows: [{ id: 'ref-1', referrer_tenant_id: 'parrain-1', status: 'PENDING' }] }) // referral lookup
          .mockResolvedValueOnce({ rows: [] }) // update PENDING->COMPLETED
          .mockResolvedValueOnce({ rows: [{ name: 'Ma Boutique' }] }) // filleule name
          .mockResolvedValueOnce({ rows: [] }) // audit REFERRAL_COMPLETED
          .mockResolvedValueOnce({ rows: [] }) // notif parrain
          .mockResolvedValueOnce({ rows: [{ id: 'ref-1' }] }) // completed referrals (1 seul)
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      const sub = await service.activatePro('tenant-1', 'MONTHLY', 'admin-1', '127.0.0.1', 'UA');
      expect(sub.tier).toBe('PRO');
    });
  });

  describe('checkAndExpireSubscriptions', () => {
    it('devrait expirer les abonnements dépassés et renvoyer le nombre', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 'sub-1', tenant_id: 'tenant-1' }]
      } as any);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }) // update status EXPIRED
          .mockResolvedValueOnce({ rows: [] }) // insert FREE sub
          .mockResolvedValueOnce({ rows: [] }) // notif
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      const count = await service.checkAndExpireSubscriptions();
      expect(count).toBe(1);
    });
  });

  describe('notifySubscriptionsExpiringSoon', () => {
    it('devrait envoyer des notifications idempotentes J-7/J-3/J-1', async () => {
      // Pour chaque days_before (3 itérations), on simule 1 sub trouvée + 0 notif existante -> 1 insertion.
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [{ id: 'sub-1', tenant_id: 't1', end_date: new Date() }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'sub-2', tenant_id: 't2', end_date: new Date() }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'sub-3', tenant_id: 't3', end_date: new Date() }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const sent = await service.notifySubscriptionsExpiringSoon();
      expect(sent).toBe(3);
    });
  });
});

describe('ReferralsService', () => {
  let service: ReferralsService;

  beforeEach(() => {
    service = new ReferralsService();
    vi.clearAllMocks();
  });

  it('getReferralInfo devrait retourner le code et les stats', async () => {
    vi.spyOn(database, 'query')
      .mockResolvedValueOnce({ rows: [{ referral_code: 'RD-SHOP-123', name: 'Ma Boutique' }] } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'r1', referred_tenant_name: 'Filleul1', status: 'COMPLETED', created_at: new Date(), completed_at: new Date(), rewarded_at: null }] } as any);

    const info = await service.getReferralInfo('tenant-1');
    expect(info.referral_code).toBe('RD-SHOP-123');
    expect(info.stats.completed).toBe(1);
    expect(info.stats.pending_rewards).toBe(1);
  });
});
