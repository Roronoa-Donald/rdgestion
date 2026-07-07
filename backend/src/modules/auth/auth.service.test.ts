import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import * as database from '../../config/database';
import * as passwordUtils from '../../utils/password';
import * as tokenUtils from '../../utils/token';
import { seedCategoriesForTenant } from '../../database/seed/categories';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('../../utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  verifyPassword: vi.fn()
}));

vi.mock('../../utils/token', () => ({
  signToken: vi.fn().mockReturnValue('mocked_jwt_token')
}));

vi.mock('../../database/seed/categories', () => ({
  seedCategoriesForTenant: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../utils/referral-code', () => ({
  generateUniqueReferralCode: vi.fn().mockResolvedValue('RD-TESTSHOP-123')
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('devrait lever une erreur si les mots de passe ne correspondent pas', async () => {
      const input = {
        shop_name: 'Test Shop',
        owner_name: 'Test Owner',
        phone: '+22890123456',
        password: 'Password123',
        password_confirm: 'DifferentPassword'
      };

      await expect(authService.register(input, '127.0.0.1', 'Mozilla')).rejects.toThrow(
        'Les mots de passe ne correspondent pas.'
      );
    });

    it('devrait lever une erreur si le numéro de téléphone est déjà pris', async () => {
      const input = {
        shop_name: 'Test Shop',
        owner_name: 'Test Owner',
        phone: '+22890123456',
        password: 'Password123',
        password_confirm: 'Password123'
      };

      // Mocker query pour simuler que le téléphone existe
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'existing-tenant-id' }]
      } as any);

      await expect(authService.register(input, '127.0.0.1', 'Mozilla')).rejects.toThrow(
        'Ce numéro de téléphone est déjà associé à une boutique.'
      );
    });

    it('devrait enregistrer avec succès une nouvelle boutique et son gérant', async () => {
      const input = {
        shop_name: 'Test Shop',
        owner_name: 'Test Owner',
        phone: '+22890123456',
        password: 'Password123',
        password_confirm: 'Password123'
      };

      // Simuler que le numéro de téléphone est libre
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      // Mocker la transaction
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'tenant-123', name: 'Test Shop' }] }) // insert tenant
          .mockResolvedValueOnce({ rows: [] }) // insert subscription
          .mockResolvedValueOnce({ rows: [{ id: 'user-123', username: '+22890123456', role: 'ADMIN' }] }) // insert user
          .mockResolvedValueOnce({ rows: [] }) // insert settings
          .mockResolvedValueOnce({ rows: [] }) // audit log tenant
          .mockResolvedValueOnce({ rows: [] }) // audit log user
      };

      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => {
        return cb(mockClient);
      });

      const result = await authService.register(input, '127.0.0.1', 'Mozilla');

      expect(result.token).toBe('mocked_jwt_token');
      expect(result.user.shop_name).toBe('Test Shop');
      expect(result.user.role).toBe('ADMIN');
      expect(mockClient.query).toHaveBeenCalledTimes(6);
      expect(seedCategoriesForTenant).toHaveBeenCalledWith('tenant-123', []);
    });

    it('devrait enregistrer une nouvelle boutique avec des secteurs d activité spécifiques et appeler le seed', async () => {
      const input = {
        shop_name: 'Test Shop',
        owner_name: 'Test Owner',
        phone: '+22890123456',
        password: 'Password123',
        password_confirm: 'Password123',
        sectors: ['Alimentation générale', 'Cosmétiques / Beauté']
      };

      // Simuler que le numéro de téléphone est libre
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      // Mocker la transaction
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'tenant-123', name: 'Test Shop' }] }) // insert tenant
          .mockResolvedValueOnce({ rows: [] }) // insert subscription
          .mockResolvedValueOnce({ rows: [{ id: 'user-123', username: '+22890123456', role: 'ADMIN' }] }) // insert user
          .mockResolvedValueOnce({ rows: [] }) // insert settings
          .mockResolvedValueOnce({ rows: [] }) // audit log tenant
          .mockResolvedValueOnce({ rows: [] }) // audit log user
      };

      vi.spyOn(database, 'transaction').mockImplementationOnce(async (cb: any) => {
        return cb(mockClient);
      });

      const result = await authService.register(input, '127.0.0.1', 'Mozilla');

      expect(result.token).toBe('mocked_jwt_token');
      expect(seedCategoriesForTenant).toHaveBeenCalledWith('tenant-123', ['Alimentation générale', 'Cosmétiques / Beauté']);
    });
  });

  describe('login', () => {
    it('devrait lever une erreur si l\'identifiant est incorrect', async () => {
      // Simuler utilisateur introuvable
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 0,
        rows: []
      } as any);

      vi.spyOn(passwordUtils, 'verifyPassword').mockResolvedValueOnce(false);

      await expect(
        authService.login({ identifier: 'wrong-user', password: 'password' }, '127.0.0.1', 'Mozilla')
      ).rejects.toThrow('Identifiant ou mot de passe incorrect.');
    });

    it('devrait lever une erreur si le mot de passe est invalide', async () => {
      // Simuler utilisateur trouvé
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'user-123',
          tenant_id: 'tenant-123',
          username: '+22890123456',
          password_hash: 'hash',
          role: 'ADMIN',
          is_active: true
        }]
      } as any);

      vi.spyOn(passwordUtils, 'verifyPassword').mockResolvedValueOnce(false);

      await expect(
        authService.login({ identifier: '+22890123456', password: 'wrongpassword' }, '127.0.0.1', 'Mozilla')
      ).rejects.toThrow('Identifiant ou mot de passe incorrect.');
    });

    it('devrait connecter l\'utilisateur gérant avec succès', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            id: 'user-123',
            tenant_id: 'tenant-123',
            username: '+22890123456',
            password_hash: 'hash',
            role: 'ADMIN',
            is_active: true
          }]
        } as any) // Query 1: Select user
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ name: 'Test Shop', is_active: true }]
        } as any) // Query 2: Select tenant info
        .mockResolvedValueOnce({ rows: [] } as any) // Query 3: Update last login info
        .mockResolvedValueOnce({ rows: [] } as any); // Query 4: Audit log success

      vi.spyOn(passwordUtils, 'verifyPassword').mockResolvedValueOnce(true);

      const result = await authService.login(
        { identifier: '+22890123456', password: 'correctpassword' },
        '127.0.0.1',
        'Mozilla'
      );

      expect(result.token).toBe('mocked_jwt_token');
      expect(result.user.shop_name).toBe('Test Shop');
      expect(result.user.role).toBe('ADMIN');
    });
  });
});
