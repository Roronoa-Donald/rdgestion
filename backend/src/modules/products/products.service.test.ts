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

    it('devrait lever une erreur 409 si le barcode existe déjà pour un autre produit du tenant', async () => {
      const data = {
        name: 'Doliprane',
        sku: 'DOLI-123',
        barcode: '3014250050017',
        purchase_price: 500,
        sell_price: 700,
        stock_quantity: 10
      };

      // query sera appelée 2 fois : 1) check SKU (disponible), 2) check barcode (existant).
      // On mock directement database.query (déjà un vi.fn() via vi.mock) sans spyOn
      // car les spy empilés par les tests précédents peuvent masquer les mockResolvedValueOnce.
      (database.query as any)
        .mockResolvedValueOnce({ rowCount: 0, rows: [] } as any) // SKU check: disponible
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'other-product-id' }] } as any); // barcode check: existant

      await expect(
        productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla')
      ).rejects.toThrow('Le code-barre "3014250050017" est déjà utilisé par un autre produit.');
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
              barcode: null,
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

    it('devrait créer un produit avec un barcode et transaction + alertes de stock', async () => {
      const data = {
        name: 'Paracétamol',
        barcode: '3014250050017',
        purchase_price: 500,
        sell_price: 700,
        stock_quantity: 50,
        stock_threshold: 10
      };

      // 1er query: check SKU (pas de sku fourni → generateSKU)
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);
      // 2ème query: check barcode (disponible)
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [{
              id: 'product-456',
              name: 'Paracétamol',
              sku: 'SKU-PARA',
              barcode: '3014250050017',
              purchase_price: 500,
              sell_price: 700,
              stock_quantity: 50,
              stock_threshold: 10
            }]
          }) // insert query
          .mockResolvedValueOnce({ rows: [{ username: 'gerant', role: 'ADMIN' }] }) // select user
          .mockResolvedValueOnce({ rows: [] }) // audit log insert
          .mockResolvedValueOnce({ rows: [{ global_stock_threshold: 20 }] }) // select settings
      };

      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => {
        return cb(mockClient);
      });

      const result = await productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla');

      expect(result.id).toBe('product-456');
      expect(result.barcode).toBe('3014250050017');
      expect(mockClient.query).toHaveBeenCalledTimes(4);
    });

    it('devrait créer un produit sans barcode (null) — le barcode n\'est pas required', async () => {
      const data = {
        name: 'Produit Sans Code-Barre',
        purchase_price: 500,
        sell_price: 700,
        stock_quantity: 10
        // pas de champ barcode → doit rester nullable et valide
      };

      // check SKU (pas de sku fourni)
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [{
              id: 'product-null-barcode',
              name: 'Produit Sans Code-Barre',
              sku: 'SKU-X',
              barcode: null,
              purchase_price: 500,
              sell_price: 700,
              stock_quantity: 10,
              stock_threshold: null
            }]
          })
          .mockResolvedValueOnce({ rows: [{ username: 'gerant', role: 'ADMIN' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ global_stock_threshold: 20 }] })
      };

      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => {
        return cb(mockClient);
      });

      const result = await productsService.createProduct('tenant-123', data, 'user-123', '127.0.0.1', 'Mozilla');

      expect(result.barcode).toBeNull();
      expect(result.id).toBe('product-null-barcode');
    });
  });

  describe('getProductByBarcode', () => {
    it('devrait retourner le produit correspondant au barcode', async () => {
      const mockProduct = {
        id: 'product-123',
        name: 'Doliprane',
        barcode: '3014250050017',
        category_name: 'Médicaments',
        tenant_id: 'tenant-123',
        is_deleted: false
      };

      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [mockProduct]
      } as any);

      const result = await productsService.getProductByBarcode('tenant-123', '3014250050017');

      expect(result).toEqual(mockProduct);
      expect(database.query).toHaveBeenCalledWith(
        expect.stringContaining('p.barcode = $2'),
        ['tenant-123', '3014250050017']
      );
    });

    it('devrait lever une erreur 404 si aucun produit ne correspond au barcode', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      await expect(
        productsService.getProductByBarcode('tenant-123', '0000000000000')
      ).rejects.toThrow('Aucun produit trouvé avec ce code-barres.');
    });
  });

  describe('updateProduct', () => {
    it('devrait lever une erreur 409 si le nouveau barcode existe déjà pour un autre produit', async () => {
      // getProductById (récupère le produit courant)
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'product-1',
          name: 'Ancien',
          sku: 'SKU-1',
          barcode: null,
          purchase_price: 500,
          sell_price: 700,
          stock_quantity: 10
        }]
      } as any);
      // check barcode (existant sur un autre produit)
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'product-2' }]
      } as any);

      await expect(
        productsService.updateProduct(
          'tenant-123',
          'product-1',
          { barcode: '3014250050017' },
          'user-1',
          '127.0.0.1',
          'Mozilla'
        )
      ).rejects.toThrow('Le code-barre "3014250050017" est déjà utilisé par un autre produit.');
    });
  });
});
