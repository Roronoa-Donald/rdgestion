import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { salesController } from './sales.controller';
import { createSaleSchema, getSalesSchema, saleIdParamSchema } from './sales.schema';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';

export async function salesRoutes(fastify: FastifyInstance) {
  // Ajouter le décorateur d'audit pour tracer les ventes
  fastify.addHook('preHandler', auditDecorator);

  // Enregistrer une vente (ADMIN et SELLER)
  fastify.post('/', {
    schema: createSaleSchema,
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => salesController.create(request, reply));

  // Lister l'historique des ventes (ADMIN et SELLER)
  fastify.get('/', {
    schema: getSalesSchema,
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => salesController.list(request, reply));

  // Récupérer une vente par ID (ADMIN et SELLER)
  fastify.get('/:id', {
    schema: saleIdParamSchema,
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => salesController.getById(request, reply));

  // Annuler une vente (ADMIN et SELLER)
  fastify.post('/:id/cancel', {
    schema: saleIdParamSchema,
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => salesController.cancel(request, reply));

  // Générer/imprimer un ticket de caisse HTML (ADMIN et SELLER)
  fastify.get('/:id/ticket', {
    schema: saleIdParamSchema,
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => salesController.getTicketHtml(request, reply));
}
