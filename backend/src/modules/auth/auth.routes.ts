import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authController } from './auth.controller';
import { registerSchema, loginSchema, createVendorSchema } from './auth.schema';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';

/**
 * Enregistrement des routes d'authentification.
 */
export async function authRoutes(fastify: FastifyInstance) {
  // Ajouter le décorateur d'audit sur l'ensemble de ces routes
  fastify.addHook('preHandler', auditDecorator);

  // Inscription publique
  fastify.post('/register', {
    schema: registerSchema,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, (request: FastifyRequest, reply: FastifyReply) => authController.register(request as any, reply));

  // Connexion publique
  fastify.post('/login', {
    schema: loginSchema,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, (request: FastifyRequest, reply: FastifyReply) => authController.login(request as any, reply));

  // Création de vendeur (Rôle ADMIN sur Tenant actif)
  fastify.post('/vendors', {
    schema: createVendorSchema,
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => authController.createVendor(request as any, reply));
}
