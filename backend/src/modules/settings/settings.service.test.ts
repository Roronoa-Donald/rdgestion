import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SettingsService } from './settings.service';
import * as database from '../../config/database';
import * as passwordUtils from '../../utils/password';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  pool: { end: vi.fn() }
}));

vi.mock('../../utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  verifyPassword: vi.fn()
}));

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    service = new SettingsService();
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('devrait retourner les settings existants', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 'set-1', tenant_id: 'tenant-1', global_stock_threshold: 20 }]
      } as any);

      const s = await service.getSettings('tenant-1');
      expect(s.id).toBe('set-1');
    });

    it('devrait créer les settings par défaut si absents', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'set-new', tenant_id: 'tenant-1' }] } as any);

      const s = await service.getSettings('tenant-1');
      expect(s.id).toBe('set-new');
    });
  });

  describe('updateSettings (gate PRO)', () => {
    it('devrait rejeter la personnalisation ticket si FREE (PRO_REQUIRED)', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({
          rows: [{ id: 'set-1', tenant_id: 'tenant-1', global_stock_threshold: 20 }]
        } as any) // getSettings
        .mockResolvedValueOnce({ rows: [{ tier: 'FREE' }] } as any); // sub check

      await expect(
        service.updateSettings('tenant-1', { ticket_show_logo: true, ticket_width: 80 } as any, 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('nécessitent un abonnement PRO');
    });
  });

  describe('changePassword', () => {
    it('devrait rejeter si l utilisateur n existe pas (404)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        service.changePassword('tenant-1', 'user-unknown', 'old', 'new', '127.0.0.1', 'UA')
      ).rejects.toThrow('Utilisateur introuvable.');
    });

    it('devrait rejeter si l ancien mot de passe est invalide (INVALID_PASSWORD)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 'user-1', username: 'admin', password_hash: 'hash', role: 'ADMIN' }]
      } as any);
      vi.spyOn(passwordUtils, 'verifyPassword').mockResolvedValueOnce(false);

      await expect(
        service.changePassword('tenant-1', 'user-1', 'wrong-old', 'new', '127.0.0.1', 'UA')
      ).rejects.toThrow('L\'ancien mot de passe est incorrect.');
    });

    it('devrait mettre à jour le mot de passe et logger PASSWORD_CHANGE', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({
          rows: [{ id: 'user-1', username: 'admin', password_hash: 'hash', role: 'ADMIN' }]
        } as any) // select user (1er appel)
        .mockResolvedValueOnce({ rows: [] } as any) // update password (2e appel)
        .mockResolvedValueOnce({ rows: [] } as any); // audit log (3e appel)
      vi.spyOn(passwordUtils, 'verifyPassword').mockResolvedValueOnce(true);
      vi.spyOn(passwordUtils, 'hashPassword').mockResolvedValueOnce('new_hash');

      await service.changePassword('tenant-1', 'user-1', 'old', 'new', '127.0.0.1', 'UA');
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('new');
    });
  });

  describe('resetVendorPassword', () => {
    it('devrait rejeter un reset sur un non-vendeur (FORBIDDEN)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 'user-1', username: 'notseller', role: 'ADMIN' }]
      } as any);

      await expect(
        service.resetVendorPassword('tenant-1', 'user-1', 'new', 'admin-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('que sur un compte vendeur');
    });

    it('devrait rejeter si la cible n existe pas (404)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        service.resetVendorPassword('tenant-1', 'unknown', 'new', 'admin-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Utilisateur introuvable.');
    });
  });

  describe('toggleVendorStatus', () => {
    it('devrait rejeter un vendeur inexistant (404)', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        service.toggleVendorStatus('tenant-1', 'unknown', true, 'user-1', '127.0.0.1', 'UA')
      ).rejects.toThrow('Vendeur introuvable.');
    });
  });
});
