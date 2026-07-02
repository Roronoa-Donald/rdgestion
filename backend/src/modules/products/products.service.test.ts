import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProductsService } from './products.service';
import * as database from '../../config/database';
import * as dateUtils from '../../utils/date';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../../utils/date', () => ({
  isFutureDate: vi.fn()
}));

describe('ProductsService', () => {
  let productsService: ProductsService;

  beforeEach(() => {
    productsService = new ProductsService();
    vi.clearAllMocks();
  });

  describe('createProduct', () => {
    it('devrait lever une erreur si le prix de vente est inférieur au prix d\'achat', async () => {
      const data = {
        name: 'Produit Invalide',
        purchase_price: 1500,
        sell_price: 1200,
        stock_quantity: 10
      };

      await expect(
        productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla')
      ).rejects.toThrow('Le prix de vente doit être supérieur ou égal au prix d\'achat.');
    });

    it('devrait lever une erreur si le produit est périssable mais sans date de péremption', async () => {
      const data = {
        name: 'Produit Périssable',
        purchase_price: 500,
        sell_price: 700,
        stock_quantity: 10,
        has_expiry: true,
        expiry_date: null
      };

      await expect(
        productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla')
      ).rejects.toThrow('La date de péremption est obligatoire pour les produits périssables.');
    });

    it('devrait lever une erreur si la date de péremption est dans le passé', async () => {
      const data = {
        name: 'Produit Périssable',
        purchase_price: 500,
        sell_price: 700,
        stock_quantity: 10,
        has_expiry: true,
        expiry_date: '2020-01-01'
      };

      vi.spyOn(dateUtils, 'isFutureDate').mockReturnValueOnce(false);

      await expect(
        productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla')
      ).rejects.toThrow('La date de péremption doit être dans le futur.');
    });

    it('devrait lever une erreur si le SKU personnalisé existe déjà', async () => {
      const data = {
        name: 'Doliprane',
        sku: 'DOLI-123',
        purchase_price: 500,
        sell_price: 700,
        stock_quantity: 10
      };

      // Simuler que le SKU existe déjà
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'other-product-id' }]
      } as any);

      await expect(
        productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla')
      ).rejects.toThrow('Le code SKU "DOLI-123" est déjà utilisé par un autre produit.');
    });

    it('devrait créer un produit avec succès avec transaction et alertes de stock', async () => {
      const data = {
        name: 'Doliprane',
        purchase_price: 500,
        sell_price: 700,
        stock_quantity: 50,
        stock_threshold: 10
      };

      // Simuler que le SKU n'existe pas en BDD
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [{
              id: 'product-123',
              name: 'Doliprane',
              sku: 'SKU-DOLI',
              purchase_price: 500,
              sell_price: 700,
              stock_quantity: 50,
              stock_threshold: 10
            }]
          }) // insert query
          .mockResolvedValueOnce({ rows: [{ username: 'gerant', role: 'ADMIN' }] }) // select user
          .mockResolvedValueOnce({ rows: [] }) // audit log insert
          .mockResolvedValueOnce({ rows: [{ global_stock_threshold: 20 }] }) // select settings global threshold
      };

      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => {
        return cb(mockClient);
      });

      const result = await productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla');

      expect(result.id).toBe('product-123');
      expect(result.name).toBe('Doliprane');
      expect(mockClient.query).toHaveBeenCalledTimes(4);
    });
  });
});
