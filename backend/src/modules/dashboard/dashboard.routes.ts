import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Statistiques du tableau de bord (ADMIN uniquement)
  fastify.get('/', {
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => dashboardController.getStats(request, reply));

  // Alias rétro-compatible /stats
  fastify.get('/stats', {
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => dashboardController.getStats(request, reply));
}
