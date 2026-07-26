import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { settingsController } from './settings.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';
import { passwordChangeSchema, vendorResetPasswordSchema, vendorUpdateSchema, updateProfileSchema } from './settings.schema';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', auditDecorator);

  const adminOnly = [authenticate, authorize(['ADMIN']), checkTenantActive];
  const adminOrSeller = [authenticate, authorize(['ADMIN', 'SELLER']), checkTenantActive];

  // Paramètres boutique
  fastify.get('/', { preHandler: adminOnly }, (request: FastifyRequest, reply: FastifyReply) => settingsController.getSettings(request, reply));
  fastify.put('/', { preHandler: adminOnly }, (request: FastifyRequest<any>, reply: FastifyReply) => settingsController.updateSettings(request, reply));

  // Profil de la boutique (tenant)
  fastify.get('/profile', { preHandler: adminOnly }, (request: FastifyRequest, reply: FastifyReply) => settingsController.getTenantProfile(request, reply));
  fastify.put('/profile', {
    schema: updateProfileSchema,
    preHandler: adminOnly
  }, (request: FastifyRequest<any>, reply: FastifyReply) => settingsController.updateTenantProfile(request, reply));

  // Gestion des vendeurs
  fastify.get('/vendors', { preHandler: adminOnly }, (request: FastifyRequest, reply: FastifyReply) => settingsController.listVendors(request, reply));
  fastify.patch('/vendors/:id', {
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
      },
      body: { type: 'object', required: ['is_active'], properties: { is_active: { type: 'boolean' } }, additionalProperties: false }
    },
    preHandler: adminOnly
  }, (request: FastifyRequest<any>, reply: FastifyReply) => settingsController.toggleVendorStatus(request, reply));

  // Modification du display_name d'un vendeur
  fastify.put('/vendors/:id', {
    schema: {
      ...vendorUpdateSchema,
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
    preHandler: adminOnly
  }, (request: FastifyRequest, reply: FastifyReply) => settingsController.updateVendor(request as any, reply));

  // Réinitialisation du mot de passe d'un vendeur
  fastify.post('/vendors/:id/reset-password', {
    schema: {
      ...vendorResetPasswordSchema,
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
    preHandler: adminOnly
  }, (request: FastifyRequest, reply: FastifyReply) => settingsController.resetVendorPassword(request as any, reply));

  // Changement du mot de passe de l'utilisateur courant
  // Autorisé pour ADMIN et SELLER : le service utilise userId du JWT,
  // donc pas de risque d'IDOR (chaque utilisateur modifie son propre mot de passe).
  fastify.put('/password', {
    schema: passwordChangeSchema,
    preHandler: adminOrSeller
  }, (request: FastifyRequest, reply: FastifyReply) => settingsController.changePassword(request as any, reply));
}
