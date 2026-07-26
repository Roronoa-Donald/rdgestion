import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';

export async function notificationsRoutes(fastify: FastifyInstance) {
  // Décorateur d'audit — expose request.logAudit() pour les logs d'activité
  fastify.addHook('preHandler', auditDecorator);

  const preHandler = [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive];

  // Liste des notifications (avec compteur badge)
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: { all: { type: 'boolean', default: false } },
        additionalProperties: false
      }
    },
    preHandler
  }, (request: FastifyRequest<any>, reply: FastifyReply) => notificationsController.list(request, reply));

  // Marquer une notification comme lue
  fastify.patch('/:id/read', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          }
        },
        additionalProperties: false
      }
    },
    preHandler
  }, (request: FastifyRequest<any>, reply: FastifyReply) => notificationsController.markRead(request, reply));

  // Marquer toutes les notifications comme lues
  fastify.post('/read-all', {
    preHandler
  }, (request: FastifyRequest, reply: FastifyReply) => notificationsController.markAllRead(request, reply));
}
