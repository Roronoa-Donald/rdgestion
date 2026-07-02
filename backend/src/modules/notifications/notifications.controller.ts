import { FastifyRequest, FastifyReply } from 'fastify';
import { notificationsService } from './notifications.service';

export class NotificationsController {
  async list(request: FastifyRequest<{ Querystring: { all?: boolean } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const includeRead = request.query.all === true;
    const result = await notificationsService.listNotifications(tenantId, userId, includeRead);
    return reply.send({ success: true, data: result });
  }

  async markRead(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    await notificationsService.markAsRead(tenantId, request.params.id);
    return reply.send({ success: true, message: 'Notification marquée comme lue.' });
  }

  async markAllRead(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    await notificationsService.markAllAsRead(tenantId, userId);
    return reply.send({ success: true, message: 'Toutes les notifications ont été marquées comme lues.' });
  }
}

export const notificationsController = new NotificationsController();
