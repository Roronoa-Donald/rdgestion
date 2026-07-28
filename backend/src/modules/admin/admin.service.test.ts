import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionsService, ReferralsService, AdminService } from './admin.service';
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

    it('devrait activer PRO via FedaPay (sentinel system user → null, pas de SELECT user)', async () => {
      // Quand c'est FedaPay qui déclenche l'activation, activatedByUserId = sentinel.
      // Le code convertit le sentinel en null → pas de SELECT user dans la DB.
      // La chaîne d'appels est donc : expire + insert sub + notif + audit + referral lookup.
      const SYSTEM_SENTINEL = '00000000-0000-0000-0000-000000000000';
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }) // expire old subs
          .mockResolvedValueOnce({ rows: [{ id: 'sub-fedapay', tier: 'PRO', billing_type: 'LIFETIME', status: 'ACTIVE' }] }) // insert new sub
          .mockResolvedValueOnce({ rows: [] }) // notification
          // PAS de mockResolvedValueOnce pour SELECT user — skipped car effectiveUserId = null
          .mockResolvedValueOnce({ rows: [] }) // audit log (user_id = null)
          .mockResolvedValueOnce({ rows: [] }) // referral lookup (none)
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      const sub = await service.activatePro('tenant-1', 'LIFETIME', SYSTEM_SENTINEL, '127.0.0.1', 'UA', 'FEDAPAY');
      expect(sub.tier).toBe('PRO');
      expect(sub.billing_type).toBe('LIFETIME');
      // Vérifier que le 4e appel (audit log) a bien reçu null comme user_id
      // calls[3] = [sqlString, [tenantId, effectiveUserId(null), username, role, ...]]
      const auditCall = mockClient.query.mock.calls[3] as [string, unknown[]];
      expect(auditCall[1][1]).toBeNull(); // 2e param ($2) = user_id → null
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

describe('AdminService - getDashboardAnalytics', () => {
  let service: AdminService;

  beforeEach(() => {
    service = new AdminService();
    vi.clearAllMocks();
  });

  // Helper : construit le row factice renvoyé par l'unique query CTE.
  // Toutes les valeurs count sont passées en string pour coller au driver pg.
  const fakeRow = (overrides: Record<string, any> = {}) => ({
    total_inscriptions: '100',
    inscrits_aujourd_hui: '5',
    inscrits_7j: '20',
    inscrits_30j: '60',
    referrals_completed: '10',
    onboarding_total: '100',
    onboarding_completes: '80',
    onboarding_en_cours: '20',
    boutiques_premiere_vente: '70',
    produits_crees_total: '500',
    categories_crees_total: '120',
    boutiques_actives_7j: '45',
    boutiques_actives_30j: '60',
    ventes_aujourd_hui: '150',
    ventes_7j: '900',
    ventes_30j: '3500',
    free_count: '70',
    pro_count: '30',
    pro_monthly_count: '25',
    pro_lifetime_count: '5',
    pro_expired_count: '8',
    abonnements_expirant_7j: '3',
    boutiques_inactives: '4',
    alertes_stock_rupture: '12',
    notifications_non_lues_total: '200',
    erreurs_recentes: '7',
    evolution_ventes: [
      { date: '2026-07-27', count: '150', revenue: '450000' }
    ],
    evolution_inscriptions: [
      { date: '2026-07-27', count: '5' }
    ],
    top_boutiques_par_ventes: [
      { tenant_name: 'Pharmacie Test', ventes_count: '800', revenue: '2400000' }
    ],
    par_ville: [
      { city: 'Lomé', count: '50' }
    ],
    par_pays: [
      { country: 'Togo', count: '70' }
    ],
    ...overrides
  });

  it('devrait calculer tous les KPIs et structurer la réponse en 6 groupes', async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [fakeRow()] } as any);

    const result: any = await service.getDashboardAnalytics();

    // Groupes attendus
    expect(result).toHaveProperty('acquisition');
    expect(result).toHaveProperty('activation');
    expect(result).toHaveProperty('engagement');
    expect(result).toHaveProperty('monetisation');
    expect(result).toHaveProperty('sante_plateforme');
    expect(result).toHaveProperty('repartition');

    // ACQUISITION — casts numeriques
    expect(result.acquisition.total_inscriptions).toBe(100);
    expect(result.acquisition.inscrits_aujourd_hui).toBe(5);
    expect(result.acquisition.inscrits_7j).toBe(20);
    expect(result.acquisition.inscrits_30j).toBe(60);
    expect(result.acquisition.evolution_inscriptions).toHaveLength(1);
    expect(result.acquisition.evolution_inscriptions[0].count).toBe(5);
    // conversion_parrainage = 10 / 100 * 100 = 10 (%)
    expect(result.acquisition.conversion_parrainage).toBe(10);
  });

  it('devrait calculer le taux de completion onboarding (80%)', async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [fakeRow()] } as any);

    const result: any = await service.getDashboardAnalytics();
    // 80 completes / 100 total * 100 = 80
    expect(result.activation.onboarding_completion_rate).toBe(80);
    expect(result.activation.onboarding_en_cours).toBe(20);
    expect(result.activation.boutiques_premiere_vente).toBe(70);
    expect(result.activation.produits_crees_total).toBe(500);
    expect(result.activation.categories_crees_total).toBe(120);
  });

  it('devrait calculer le MRR = pro_monthly_count * 5000', async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [fakeRow()] } as any);

    const result: any = await service.getDashboardAnalytics();
    // 25 mensuels * 5000 FCFA = 125000
    expect(result.monetisation.mrr).toBe(125000);
    expect(result.monetisation.free_count).toBe(70);
    expect(result.monetisation.pro_count).toBe(30);
    expect(result.monetisation.pro_monthly_count).toBe(25);
    expect(result.monetisation.pro_lifetime_count).toBe(5);
  });

  it('devrait calculer la conversion FREE->PRO = pro / (free + pro) * 100', async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [fakeRow()] } as any);

    const result: any = await service.getDashboardAnalytics();
    // 30 / (70 + 30) * 100 = 30
    expect(result.monetisation.conversion_free_to_pro).toBe(30);
  });

  it('devrait calculer le churn = pro_expired / (pro + pro_expired) * 100', async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [fakeRow()] } as any);

    const result: any = await service.getDashboardAnalytics();
    // 8 / (30 + 8) * 100 = 21.05 (arrondi à 2 décimales)
    expect(result.monetisation.churn_rate).toBeCloseTo(21.05, 2);
  });

  it('devrait convertir les clés et revenue des arrays en number', async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [fakeRow()] } as any);

    const result: any = await service.getDashboardAnalytics();
    const ev = result.engagement.evolution_ventes[0];
    expect(typeof ev.count).toBe('number');
    expect(ev.count).toBe(150);
    expect(typeof ev.revenue).toBe('number');
    expect(ev.revenue).toBe(450000);
    expect(result.engagement.top_boutiques_par_ventes[0].ventes_count).toBe(800);
    expect(result.repartition.par_ville[0].count).toBe(50);
    expect(result.repartition.par_pays[0].count).toBe(70);
  });

  it('devrait gérer zéro inscription sans division par zéro (rates = 0)', async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({
      rows: [fakeRow({
        total_inscriptions: '0',
        inscrits_aujourd_hui: '0',
        inscrits_7j: '0',
        inscrits_30j: '0',
        referrals_completed: '0',
        onboarding_total: '0',
        onboarding_completes: '0',
        onboarding_en_cours: '0',
        free_count: '0',
        pro_count: '0',
        pro_monthly_count: '0',
        pro_lifetime_count: '0',
        pro_expired_count: '0',
        evolution_ventes: [],
        evolution_inscriptions: [],
        top_boutiques_par_ventes: [],
        par_ville: [],
        par_pays: []
      })]
    } as any);

    const result: any = await service.getDashboardAnalytics();
    expect(result.acquisition.total_inscriptions).toBe(0);
    expect(result.acquisition.conversion_parrainage).toBe(0);
    expect(result.activation.onboarding_completion_rate).toBe(0);
    expect(result.monetisation.mrr).toBe(0);
    expect(result.monetisation.conversion_free_to_pro).toBe(0);
    expect(result.monetisation.churn_rate).toBe(0);
    expect(result.acquisition.evolution_inscriptions).toEqual([]);
    expect(result.repartition.par_ville).toEqual([]);
  });

  it('devrait exclure le tenant système en passant SYSTEM_TENANT_ID en paramètre $1', async () => {
    const spy = vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [fakeRow()] } as any);
    await service.getDashboardAnalytics();
    // Un seul appel à query pour toute la méthode
    expect(spy).toHaveBeenCalledTimes(1);
    const [sql, params] = spy.mock.calls[0] as [string, unknown[]];
    // Le SQL doit contenir un seul placeholder $1 (SYSTEM_TENANT_ID)
    expect(sql).toMatch(/\$1/);
    expect(params).toHaveLength(1);
    expect(params[0]).toBe('00000000-0000-0000-0000-000000000000');
  });

  it("devrait normaliser evolution_ventes vide (json_agg -> '[]'::json) en array vide", async () => {
    vi.spyOn(database, 'query').mockResolvedValueOnce({
      rows: [fakeRow({ evolution_ventes: [], top_boutiques_par_ventes: [] })]
    } as any);

    const result: any = await service.getDashboardAnalytics();
    expect(result.engagement.evolution_ventes).toEqual([]);
    expect(result.engagement.top_boutiques_par_ventes).toEqual([]);
  });
});
