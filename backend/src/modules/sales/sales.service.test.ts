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
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ status: 'EXPIRED', tier: 'PRO' }]
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
  });

  describe('cancelSale', () => {
    it('devrait renvoyer 404 si la vente n existe pas', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);

      await expect(
        service.cancelSale('tenant-1', 'sale-unknown', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Vente introuvable.');
    });

    it('devrait refuser l annulation d une vente déjà annulée', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'sale-1', is_cancelled: true, transaction_number: 'VENTE-2026-0000001', created_at: new Date().toISOString() }]
      } as any);

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
