import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { settingsController } from './settings.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';
import { passwordChangeSchema, vendorResetPasswordSchema, vendorUpdateSchema } from './settings.schema';

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

  // Modification du display_name d'un vendeur
  fastify.put('/vendors/:id', {
    schema: vendorUpdateSchema,
    preHandler: adminOnly
  }, (request: FastifyRequest, reply: FastifyReply) => settingsController.updateVendor(request as any, reply));

  // Réinitialisation du mot de passe d'un vendeur
  fastify.post('/vendors/:id/reset-password', {
    schema: vendorResetPasswordSchema,
    preHandler: adminOnly
  }, (request: FastifyRequest, reply: FastifyReply) => settingsController.resetVendorPassword(request as any, reply));

  // Changement du mot de passe de l'utilisateur courant
  fastify.put('/password', {
    schema: passwordChangeSchema,
    preHandler: adminOnly
  }, (request: FastifyRequest, reply: FastifyReply) => settingsController.changePassword(request as any, reply));
}
