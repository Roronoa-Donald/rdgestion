import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CategoriesService } from './categories.service';
import * as database from '../../config/database';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  pool: { end: vi.fn() }
}));

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(() => {
    service = new CategoriesService();
    vi.clearAllMocks();
  });

  describe('listCategories', () => {
    it('devrait lister les catégories du tenant', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 'cat-1', tenant_id: 'tenant-1', name: 'Autres', is_default: true, sort_order: 1 }]
      } as any);

      const cats = await service.listCategories('tenant-1');
      expect(cats).toHaveLength(1);
      expect(cats[0]!.name).toBe('Autres');
    });
  });

  describe('createCategory', () => {
    it('devrait rejeter un nom de catégorie vide', async () => {
      await expect(
        service.createCategory('tenant-1', '   ', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Le nom de la catégorie ne peut pas être vide.');
    });

    it('devrait rejeter la création si le tenant est FREE (PRO_REQUIRED)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ tier: 'FREE' }]
      } as any);

      await expect(
        service.createCategory('tenant-1', 'Compléments', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('réservée aux abonnés PRO');
    });

    it('devrait rejeter un doublon de nom (409)', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [{ tier: 'PRO' }] } as any) // sub check
        .mockResolvedValueOnce({ rows: [{ id: 'cat-existing' }] } as any); // duplicate check

      await expect(
        service.createCategory('tenant-1', 'Compléments', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('existe déjà.');
    });

    it('devrait créer une catégorie avec succès (tenant PRO)', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [{ tier: 'PRO' }] } as any) // sub check
        .mockResolvedValueOnce({ rows: [] } as any); // duplicate check (none)

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ max_order: 5 }] }) // max sort_order
          .mockResolvedValueOnce({ rows: [{ id: 'cat-new', tenant_id: 'tenant-1', name: 'Compléments', is_default: false, sort_order: 6 }] }) // insert
          .mockResolvedValueOnce({ rows: [{ username: 'admin', role: 'ADMIN' }] }) // select user
          .mockResolvedValueOnce({ rows: [] }) // audit log
      };
      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => cb(mockClient));

      const cat = await service.createCategory('tenant-1', 'Compléments', 'user-1', '127.0.0.1', 'UA');
      expect(cat.id).toBe('cat-new');
      expect(cat.sort_order).toBe(6);
    });
  });

  describe('deleteCategory', () => {
    it('devrait refuser la suppression d une catégorie inexistante (404)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        service.deleteCategory('tenant-1', 'unknown', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Catégorie introuvable.');
    });

    it('devrait refuser la suppression d une catégorie par défaut (400)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 'cat-1', tenant_id: 'tenant-1', name: 'Autres', is_default: true }]
      } as any);

      await expect(
        service.deleteCategory('tenant-1', 'cat-1', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('ne peuvent pas être supprimées.');
    });

    it('devrait échouer si la catégorie Autres est absente (500)', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({
          rows: [{ id: 'cat-2', tenant_id: 'tenant-1', name: 'Cosmétiques', is_default: false }]
        } as any) // cat exists, not default
        .mockResolvedValueOnce({ rows: [] } as any); // Autres introuvable

      await expect(
        service.deleteCategory('tenant-1', 'cat-2', 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('"Autres" est introuvable.');
    });
  });
});
