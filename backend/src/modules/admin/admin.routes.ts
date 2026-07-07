import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionsController, referralsController, adminController } from './admin.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';
import { env } from '../../config/env';
import { runSubscriptionExpirationJob } from '../../scheduler/subscriptionScheduler';

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', auditDecorator);

  // ─── Abonnements ───────────────────────────────────────────
  // Obtenir l'abonnement actuel (ADMIN de la boutique)
  fastify.get('/subscriptions/current', {
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => subscriptionsController.getCurrent(request, reply));

  // Activer un abonnement PRO pour une boutique (SUPERADMIN uniquement)
  fastify.post('/subscriptions/:tenantId/activate', {
    schema: {
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: { tenantId: { type: 'string' } },
        additionalProperties: false
      },
      body: {
        type: 'object',
        required: ['billing_type'],
        properties: { billing_type: { type: 'string', enum: ['MONTHLY', 'LIFETIME'] } },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['SUPERADMIN'])]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => subscriptionsController.activatePro(request, reply));

  // ─── Parrainage ────────────────────────────────────────────
  // Obtenir les informations de parrainage (ADMIN de la boutique)
  fastify.get('/referrals', {
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive]
  }, (request: FastifyRequest, reply: FastifyReply) => referralsController.getInfo(request, reply));

  // ─── Panel SuperAdmin ──────────────────────────────────────
  // Liste de toutes les boutiques (SUPERADMIN)
  fastify.get('/tenants', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive'] }
        },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['SUPERADMIN'])]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => adminController.listTenants(request, reply));

  // Activer / désactiver une boutique (SUPERADMIN)
  fastify.patch('/tenants/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
        additionalProperties: false
      },
      body: {
        type: 'object',
        required: ['is_active'],
        properties: { is_active: { type: 'boolean' } },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['SUPERADMIN'])]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => adminController.toggleTenantStatus(request, reply));

  // Statistiques globales de la plateforme (SUPERADMIN)
  fastify.get('/stats', {
    preHandler: [authenticate, authorize(['SUPERADMIN'])]
  }, (request: FastifyRequest, reply: FastifyReply) => adminController.getPlatformStats(request, reply));

  // Détail d'une boutique (SUPERADMIN)
  fastify.get('/tenants/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
        additionalProperties: false
      }
    },
    preHandler: [authenticate, authorize(['SUPERADMIN'])]
  }, (request: FastifyRequest<any>, reply: FastifyReply) => adminController.getTenantDetail(request, reply));

  // ─── CRON (HTTP, auth par secret partagé) ──────────────────
  // Déclenche le job d'expiration des abonnements (notifications J-7/J-3/J-1 + expiration).
  // Pas d'auth JWT : authentifié via le header x-cron-secret.
  fastify.post('/cron/expire-subscriptions', async (request: FastifyRequest, reply: FastifyReply) => {
    const provided = (request.headers['x-cron-secret'] as string) || '';
    const expected = env.CRON_SECRET;

    // En dev / fallback vide : autoriser même sans secret
    if (expected === '' && env.NODE_ENV === 'development') {
      // autorisé
    } else if (provided !== expected) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Secret cron invalide ou manquant.'
      });
    }

    try {
      const result = await runSubscriptionExpirationJob();
      return reply.send({ success: true, data: result });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Échec du job d\'expiration des abonnements.'
      });
    }
  });
}
