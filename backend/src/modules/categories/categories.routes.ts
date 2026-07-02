import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { categoriesController } from './categories.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';

export async function categoriesRoutes(fastify: FastifyInstance) {
  // Décorateur d'audit
  fastify.addHook('preHandler', auditDecorator);

  // Lister les catégories (ADMIN et SELLER)
  fastify.get('/', {
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => categoriesController.list(request, reply));

  // Créer une catégorie personnalisée (ADMIN uniquement, PRO validé par le service)
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 }
        },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => categoriesController.create(request, reply));

  // Supprimer une catégorie personnalisée (ADMIN uniquement)
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' }
        },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => categoriesController.delete(request, reply));

  // Initialiser les catégories (ADMIN uniquement)
  fastify.post('/seed', {
    schema: {
      body: {
        type: 'object',
        required: ['sectors'],
        properties: {
          sectors: { type: 'array', items: { type: 'string' } }
        },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => categoriesController.seed(request, reply));
}
