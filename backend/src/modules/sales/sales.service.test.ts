import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SalesService } from './sales.service';
import * as database from '../../config/database';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  pool: { end: vi.fn() }
}));

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(() => {
    service = new SalesService();
    vi.clearAllMocks();
  });

  describe('createSale', () => {
    const baseInput = {
      items: [{ product_id: 'prod-1', quantity: 2 }],
      payment_method: 'CASH' as const,
      amount_received: 5000
    };

    it('devrait refuser la vente si l abonnement est inactif', async () => {
      // Faille H3 — désormais la requête filtre status='ACTIVE' ET end_date,
      // donc un abonnement expiré n'est jamais renvoyé (rows: []).
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      await expect(
        service.createSale('tenant-1', 'seller-1', 'ADMIN' as any, baseInput, '127.0.0.1', 'UA')
      ).rejects.toThrow('Votre abonnement est inactif ou expiré.');
    });

    it('devrait exiger une référence Mobile Money (MOMO_REFERENCE_REQUIRED)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ status: 'ACTIVE', tier: 'PRO' }]
      } as any);

      await expect(
        service.createSale(
          'tenant-1',
          'seller-1',
          'ADMIN' as any,
          { items: [{ product_id: 'prod-1', quantity: 1 }], payment_method: 'MOBILE_MONEY' as const },
          '127.0.0.1',
          'UA'
        )
      ).rejects.toThrow('La référence de transaction est obligatoire');
    });

    it('devrait bloquer au-delà de la limite journalière FREE (DAILY_LIMIT_REACHED)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ status: 'ACTIVE', tier: 'FREE' }]
      } as any);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ username: 'seller', role: 'SELLER' }] }) // select user
          .mockResolvedValueOnce({ rows: [] }) // insert daily count on conflict
          .mockResolvedValueOnce({ rows: [{ count: 30 }] }) // select count FOR UPDATE
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      await expect(
        service.createSale('tenant-1', 'seller-1', 'SELLER' as any, baseInput, '127.0.0.1', 'UA')
      ).rejects.toThrow('Limite journalière de 30 ventes atteinte');
    });

    it('devrait refuser un panier avec stock insuffisant (STOCK_INSUFFICIENT)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ status: 'ACTIVE', tier: 'PRO' }]
      } as any);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ username: 'seller', role: 'SELLER' }] }) // select user
          .mockResolvedValueOnce({
            rows: [{
              id: 'prod-1',
              name: 'Doliprane',
              purchase_price: 100,
              sell_price: 200,
              stock_quantity: 1,
              stock_threshold: null
            }]
          }) // select products FOR UPDATE (only 1 in stock, requested 2)
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      await expect(
        service.createSale(
          'tenant-1',
          'seller-1',
          'ADMIN' as any,
          {
            items: [{ product_id: 'prod-1', quantity: 2 }],
            payment_method: 'CASH' as const,
            amount_received: 1000,
            discount_type: 'PERCENTAGE' as const,
            discount_value: 50
          },
          '127.0.0.1',
          'UA'
        )
      ).rejects.toThrow('Stock insuffisant');
    });

    it('devrait refuser une remise vendeur dépassant le max (DISCOUNT_EXCEEDS_MAX)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ status: 'ACTIVE', tier: 'PRO' }]
      } as any);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ username: 'seller', role: 'SELLER' }] }) // select user
          .mockResolvedValueOnce({
            rows: [{
              id: 'prod-1',
              name: 'Doliprane',
              purchase_price: 100,
              sell_price: 200,
              stock_quantity: 10,
              stock_threshold: null
            }]
          }) // products FOR UPDATE
          .mockResolvedValueOnce({ rows: [{ max_seller_discount_percentage: 10 }] }) // settings max discount
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      await expect(
        service.createSale(
          'tenant-1',
          'seller-1',
          'SELLER' as any,
          {
            items: [{ product_id: 'prod-1', quantity: 1 }],
            payment_method: 'CASH' as const,
            amount_received: 5000,
            discount_type: 'PERCENTAGE' as const,
            discount_value: 50
          },
          '127.0.0.1',
          'UA'
        )
      ).rejects.toThrow('La remise ne peut pas dépasser la limite vendeur');
    });

    it('devrait generer le transaction_number via nextval(sales_seq_YYYY) - Bug 17', async () => {
      // Faille H5/17 — le transaction_number doit desormais provenir d une SEQUENCE PostgreSQL
      // annuelle (sales_seq_YYYY), pas d un SELECT MAX + 1 qui race. Ce test valide que le
      // service appelle bien nextval('sales_seq_<currentYear>') et non le legacy MAX.
      const currentYear = new Date().getFullYear();

      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ status: 'ACTIVE', tier: 'PRO' }]
      } as any);

      // Mock chain: ADMIN happy-path. On utilise mockImplementation pour router selon
      // le SQL text plutot qu'une chaine fixe (fragile car le loop sale_items genere
      // un nombre variable d'appels dependant des seuils de stock). Ca robustifie le test.
      const clientQueryMock = vi.fn().mockImplementation(async (sqlOrText: string) => {
        const sql = typeof sqlOrText === 'string' ? sqlOrText : String(sqlOrText);
        // 1. SELECT seller profile
        if (sql.includes('SELECT') && sql.includes('FROM users') && sql.includes('username')) {
          return { rows: [{ username: 'admin', role: 'ADMIN' }] };
        }
        // 2. SELECT products FOR UPDATE
        if (sql.includes('SELECT') && sql.includes('FROM products') && sql.includes('FOR UPDATE')) {
          return { rows: [{
            id: 'prod-1', name: 'Doliprane',
            purchase_price: 100, sell_price: 200,
            stock_quantity: 10, stock_threshold: null
          }] };
        }
        // 3. DO $$ CREATE SEQUENCE (idempotent, skip resultat)
        if (sql.includes('CREATE SEQUENCE')) {
          return { rows: [] };
        }
        // 4. SELECT nextval (renvoie un next_val)
        if (sql.includes('nextval(')) {
          return { rows: [{ next_val: '42' }] };
        }
        // 5. INSERT INTO sales RETURNING * (renvoie la vente creee)
        if (sql.includes('INSERT INTO sales')) {
          return { rows: [{
            id: 'sale-1', transaction_number: `VENTE-${currentYear}-0000042`,
            total_amount: 400, is_cancelled: false, created_at: new Date().toISOString(),
            // ...autres champs necessaires pour le code suite
            seller_id: 'admin-1', tenant_id: 'tenant-1'
          }] };
        }
        // 6. SELECT global_stock_threshold
        if (sql.includes('global_stock_threshold')) {
          return { rows: [{ global_stock_threshold: 20 }] };
        }
        // 7. INSERT INTO sale_items (loop)
        if (sql.includes('INSERT INTO sale_items')) {
          return { rows: [{ id: 'item-1', sale_id: 'sale-1', product_id: 'prod-1', quantity: 2, unit_price: 200 }] };
        }
        // 8. UPDATE products SET stock_quantity
        if (sql.startsWith('UPDATE products')) {
          return { rows: [] };
        }
        // 9. INSERT INTO daily_sale_counts ... RETURNING count as today_count
        if (sql.includes('daily_sale_counts')) {
          return { rows: [{ today_count: 1 }] };
        }
        // 10. INSERT INTO audit_logs
        if (sql.includes('INSERT INTO audit_logs')) {
          return { rows: [] };
        }
        // 11. INSERT INTO notifications
        if (sql.includes('INSERT INTO notifications')) {
          return { rows: [] };
        }
        // 12. SELECT existingAlert (si stock alerte)
        if (sql.includes('is_resolved') || (sql.includes('SELECT') && sql.includes('notifications'))) {
          return { rows: [] };
        }
        // fallback generique (autres UPDATE/INSERT / SELECT)
        return { rows: [] };
      });

      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb({ query: clientQueryMock }));

      const result = await service.createSale(
        'tenant-1', 'admin-1', 'ADMIN' as any,
        {
          items: [{ product_id: 'prod-1', quantity: 2 }],
          payment_method: 'CASH' as const,
          amount_received: 5000
        },
        '127.0.0.1', 'UA'
      );

      // Assertions:
      // 1. nextval a ete appele avec le bon nom de sequence (annee courante)
      const nextvalCall = clientQueryMock.mock.calls.find(
        (call: any) => typeof call[0] === 'string' && call[0].includes(`nextval('sales_seq_${currentYear}')`)
      );
      expect(nextvalCall).toBeDefined();

      // 2. Le numero de transaction final est au format attendu (annee + sequence pad 7)
      expect(result.transaction_number).toBe(`VENTE-${currentYear}-0000042`);

      // 3. L ancienne requete SELECT MAX(...) + 1 n est plus utilisee
      const legacyMaxCall = clientQueryMock.mock.calls.find(
        (call: any) => typeof call[0] === 'string' && call[0].includes('MAX(SUBSTRING(transaction_number')
      );
      expect(legacyMaxCall).toBeUndefined();
    });
  });

  describe('cancelSale', () => {
    it('devrait renvoyer 404 si la vente n existe pas', async () => {
      // Faille H2 — cancelSale requête maintenant le rôle de l'utilisateur en 1re
      // query (SELECT role FROM users WHERE id=...), puis le sale en 2e query.
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'ADMIN' }] } as any) // select user role
        .mockResolvedValueOnce({ rowCount: 0, rows: [] } as any); // select sale (introuvable)

      await expect(
        service.cancelSale('tenant-1', 'sale-unknown', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Vente introuvable.');
    });

    it('devrait refuser l annulation d une vente déjà annulée', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'ADMIN' }] } as any) // select user role
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 'sale-1', is_cancelled: true, transaction_number: 'VENTE-2026-0000001', created_at: new Date().toISOString() }]
        } as any); // select sale (déjà annulée)

      await expect(
        service.cancelSale('tenant-1', 'sale-1', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Cette vente a déjà été annulée.');
    });
  });

  describe('getSaleById', () => {
    it('devrait renvoyer 404 si la vente est introuvable', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);

      await expect(service.getSaleById('tenant-1', 'unknown')).rejects.toThrow('Vente introuvable.');
    });

    it('devrait retourner la vente et ses articles', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 'sale-1', tenant_id: 'tenant-1', total_amount: 1000, seller_name: 'Alice' }]
        } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'item-1', sale_id: 'sale-1' }] } as any);

      const sale = await service.getSaleById('tenant-1', 'sale-1');
      expect(sale.id).toBe('sale-1');
      expect(sale.seller_name).toBe('Alice');
      expect(sale.items).toHaveLength(1);
    });
  });
});
