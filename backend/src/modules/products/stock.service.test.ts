import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StockService } from './stock.service';
import * as database from '../../config/database';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  pool: { end: vi.fn() }
}));

describe('StockService', () => {
  let service: StockService;

  beforeEach(() => {
    service = new StockService();
    vi.clearAllMocks();
  });

  describe('createStockMovement', () => {
    function mockProductFound(stock: number, threshold: number | null = null) {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [{ id: 'prod-1', name: 'Doliprane', stock_quantity: stock, stock_threshold: threshold }]
          }) // select FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }) // update product
          .mockResolvedValueOnce({ rows: [{ id: 'mvmt-1', movement_type: 'IN', quantity: 5, old_stock: stock, new_stock: stock + 5 }] }) // insert movement
          .mockResolvedValueOnce({ rows: [{ username: 'admin', role: 'ADMIN' }] }) // select user
          .mockResolvedValueOnce({ rows: [] }) // audit log
          .mockResolvedValueOnce({ rows: [{ global_stock_threshold: 20 }] }) // settings threshold
          .mockResolvedValueOnce({ rows: [] }) // notification insert/update
      };
      return mockClient;
    }

    it('devrait refuser un mouvement sur un produit inexistant (404)', async () => {
      const mockClient = { query: vi.fn().mockResolvedValueOnce({ rows: [] }) };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      await expect(
        service.createStockMovement('tenant-1', 'unknown', { movement_type: 'IN', quantity: 5, reason: 'Réappro' }, 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Produit introuvable ou supprimé.');
    });

    it('devrait rejeter une entrée IN avec quantité <= 0 (INVALID_QUANTITY)', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [{ id: 'prod-1', name: 'Doliprane', stock_quantity: 10, stock_threshold: null }]
        })
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      await expect(
        service.createStockMovement('tenant-1', 'prod-1', { movement_type: 'IN', quantity: 0, reason: 'x' }, 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('La quantité d\'entrée doit être un entier positif.');
    });

    it('devrait rejeter une sortie OUT qui rend le stock négatif (STOCK_INSUFFICIENT)', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [{ id: 'prod-1', name: 'Doliprane', stock_quantity: 3, stock_threshold: null }]
        })
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      await expect(
        service.createStockMovement('tenant-1', 'prod-1', { movement_type: 'OUT', quantity: 5, reason: 'Sortie' }, 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Stock insuffisant pour cette sortie.');
    });

    it('devrait rejeter un ajustement ADJUSTMENT négatif', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rows: [{ id: 'prod-1', name: 'Doliprane', stock_quantity: 10, stock_threshold: null }]
        })
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      await expect(
        service.createStockMovement('tenant-1', 'prod-1', { movement_type: 'ADJUSTMENT', quantity: -1, reason: 'Inventaire' }, 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Le stock ajusté ne peut pas être négatif.');
    });

    it('devrait réussir une entrée IN et retourner le mouvement', async () => {
      const mockClient = mockProductFound(10);
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      const movement = await service.createStockMovement(
        'tenant-1',
        'prod-1',
        { movement_type: 'IN', quantity: 5, reason: 'Réappro' },
        'user-1',
        '127.0.0.1',
        'UA'
      );

      expect(movement.id).toBe('mvmt-1');
      expect(movement.movement_type).toBe('IN');
    });
  });

  describe('listStockMovements', () => {
    it('devrait retourner les mouvements paginés', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [{ id: 'm1' }] } as any) // list
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any); // count

      const result = await service.listStockMovements('tenant-1', 'prod-1', { page: 1, limit: 25 });
      expect(result.movements).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });
});
