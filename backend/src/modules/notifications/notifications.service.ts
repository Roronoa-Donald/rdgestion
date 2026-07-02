import { query } from '../../config/database';
import { Notification } from '../../types/models';

export class NotificationsService {
  /**
   * Liste les notifications non lues + récentes d'un tenant.
   */
  async listNotifications(tenantId: string, userId: string, includeRead = false) {
    let q = `
      SELECT * FROM notifications
      WHERE tenant_id = $1
        AND (user_id = $2 OR user_id IS NULL)
    `;
    const params: any[] = [tenantId, userId];

    if (!includeRead) {
      q += ` AND is_read = FALSE`;
    }

    q += ` ORDER BY created_at DESC LIMIT 50`;

    const res = await query<Notification>(q, params);

    // Compter le badge (non lues uniquement)
    const badgeRes = await query<{ count: string }>(
      `SELECT COUNT(id) as count FROM notifications 
       WHERE tenant_id = $1 AND (user_id = $2 OR user_id IS NULL) AND is_read = FALSE`,
      [tenantId, userId]
    );
    const unreadCount = parseInt(badgeRes.rows[0]?.count || '0', 10);

    return {
      notifications: res.rows,
      unread_count: unreadCount
    };
  }

  /**
   * Marque une notification comme lue.
   */
  async markAsRead(tenantId: string, notificationId: string): Promise<void> {
    await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, notificationId]
    );
  }

  /**
   * Marque toutes les notifications du tenant/utilisateur comme lues.
   */
  async markAllAsRead(tenantId: string, userId: string): Promise<void> {
    await query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
       WHERE tenant_id = $1 AND (user_id = $2 OR user_id IS NULL) AND is_read = FALSE`,
      [tenantId, userId]
    );
  }
}

export const notificationsService = new NotificationsService();
