import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { settingsController } from './settings.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', auditDecorator);

  const adminOnly = [authenticate, authorize(['ADMIN']), checkTenantActive];

  // Paramètres boutique
  fastify.get('/', { preHandler: adminOnly }, (request: FastifyRequest, reply: FastifyReply) => settingsController.getSettings(request, reply));
  fastify.put('/', { preHandler: adminOnly }, (request: FastifyRequest<any>, reply: FastifyReply) => settingsController.updateSettings(request, reply));

  // Profil de la boutique (tenant)
  fastify.get('/profile', { preHandler: adminOnly }, (request: FastifyRequest, reply: FastifyReply) => settingsController.getTenantProfile(request, reply));
  fastify.put('/profile', { preHandler: adminOnly }, (request: FastifyRequest<any>, reply: FastifyReply) => settingsController.updateTenantProfile(request, reply));

  // Gestion des vendeurs
  fastify.get('/vendors', { preHandler: adminOnly }, (request: FastifyRequest, reply: FastifyReply) => settingsController.listVendors(request, reply));
  fastify.patch('/vendors/:id', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } }, additionalProperties: false },
      body: { type: 'object', required: ['is_active'], properties: { is_active: { type: 'boolean' } }, additionalProperties: false }
    },
    preHandler: adminOnly
  }, (request: FastifyRequest<any>, reply: FastifyReply) => settingsController.toggleVendorStatus(request, reply));
}
