import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service';
import * as database from '../../config/database';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  pool: { end: vi.fn() }
}));

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(() => {
    service = new NotificationsService();
    vi.clearAllMocks();
  });

  describe('listNotifications', () => {
    it('devrait lister uniquement les non lues par défaut avec le badge unread_count', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [{ id: 'n1', is_read: false }] } as any) // liste
        .mockResolvedValueOnce({ rows: [{ count: '3' }] } as any); // badge

      const res = await service.listNotifications('tenant-1', 'user-1');
      expect(res.notifications).toHaveLength(1);
      expect(res.unread_count).toBe(3);
    });

    it('devrait inclure les notifs lues si includeRead=true', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [{ id: 'n1', is_read: true }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);

      const res = await service.listNotifications('tenant-1', 'user-1', true);
      expect(res.notifications[0]!.is_read).toBe(true);
    });
  });

  describe('markAsRead', () => {
    it('devrait mettre à jour la notification vers is_read=true', async () => {
      const querySpy = vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [] } as any);
      await service.markAsRead('tenant-1', 'notif-1');
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls[0]![0]).toContain('UPDATE notifications');
    });
  });

  describe('markAllAsRead', () => {
    it('devrait mettre à jour toutes les notifications non lues du user', async () => {
      const querySpy = vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [] } as any);
      await service.markAllAsRead('tenant-1', 'user-1');
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls[0]![0]).toContain('is_read = TRUE');
      expect(querySpy.mock.calls[0]![0]).toContain('AND is_read = FALSE');
    });
  });
});
