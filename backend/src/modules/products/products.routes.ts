import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { productsController } from './products.controller';
import { getProductsSchema, productIdParamSchema } from './products.schema';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';

export async function productsRoutes(fastify: FastifyInstance) {
  // Ajouter le décorateur d'audit pour tracer les actions produits
  fastify.addHook('preHandler', auditDecorator);

  // Liste de tous les produits actifs (Accessible par ADMIN et SELLER pour le POS)
  fastify.get('/', {
    schema: getProductsSchema,
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => productsController.list(request, reply));

  // Liste des produits en corbeille (ADMIN uniquement)
  fastify.get('/trash', {
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => productsController.listTrash(request, reply));

  // Récupérer un produit par son ID (Accessible par ADMIN et SELLER)
  fastify.get('/:id', {
    schema: productIdParamSchema,
    preHandler: [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => productsController.getById(request, reply));

  // Ajouter un nouveau produit (ADMIN uniquement)
  fastify.post('/', {
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => productsController.create(request, reply));

  // Modifier un produit existant (ADMIN uniquement)
  fastify.put('/:id', {
    schema: productIdParamSchema,
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => productsController.update(request, reply));

  // Supprimer logiquement un produit - envoyer en corbeille (ADMIN uniquement)
  fastify.delete('/:id', {
    schema: productIdParamSchema,
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => productsController.delete(request, reply));

  // Restaurer un produit de la corbeille (ADMIN uniquement)
  fastify.post('/:id/restore', {
    schema: productIdParamSchema,
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => productsController.restore(request, reply));
}
