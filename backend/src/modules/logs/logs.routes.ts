import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logsController } from './logs.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';

export async function logsRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          action: { type: 'string' },
          entity_type: { type: 'string' },
          user_id: { type: 'string' },
          from: { type: 'string', format: 'date' },
          to: { type: 'string', format: 'date' }
        },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => logsController.list(request, reply));
}
