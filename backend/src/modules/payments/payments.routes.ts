import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from './payment.factory';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { subscriptionsService } from '../admin/admin.service';

/**
 * Routes paiements — prefix `/api/payments` (enregistré dans app.ts).
 *
 * - POST /create-intent : ADMIN authentifié, crée un PaymentIntent via le
 *   service configuré (manual → 501, fedapay → intent).
 *
 * - POST /webhook/fedapay : PUBLIC (pas d'authenticate). Vérifie la signature
 *   FedaPay via paymentService.verifyWebhook, puis active l'abonnement PRO du
 *   tenant identifié dans le metadata du webhook.
 */
export async function paymentsRoutes(fastify: FastifyInstance) {
  // ─── Création d'un intent de paiement (ADMIN) ───────────────
  fastify.post('/create-intent', {
    schema: {
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 1 },
          description: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive],
  }, async (request: FastifyRequest<any>, reply: FastifyReply) => {
    try {
      const body = request.body as { amount: number; description?: string };
      const intent = await paymentService.createPaymentIntent({
        tenant_id: request.currentUser!.tenantId,
        amount: body.amount,
        description: body.description,
        metadata: { tenant_id: request.currentUser!.tenantId, user_id: request.currentUser!.userId },
      });
      return reply.send({ success: true, data: { intent } });
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      const code = (err as any).code || 'SERVER_ERROR';
      return reply.status(statusCode).send({ success: false, error: code, message: (err as Error).message });
    }
  });

  // ─── Webhook FedaPay (PUBLIC) ──────────────────────────────
  fastify.post('/webhook/fedapay', {}, async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = (request.headers['x-signature'] as string) || '';

    let result;
    try {
      result = await paymentService.verifyWebhook(request.body, signature);
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      const code = (err as any).code || 'SERVER_ERROR';
      return reply.status(statusCode).send({ success: false, error: code, message: (err as Error).message });
    }

    // Activation PRO sur le tenant identifié dans le metadata du webhook.
    const raw = (result.raw_payload || {}) as Record<string, unknown>;
    const metadata = (raw.metadata || {}) as Record<string, unknown>;
    const tenantId = metadata.tenant_id as string | undefined;
    const billingType = (metadata.billing_type as 'MONTHLY' | 'LIFETIME') || 'MONTHLY';

    if (!tenantId) {
      return reply.status(400).send({
        success: false,
        error: 'WEBHOOK_MISSING_TENANT',
        message: 'Aucun tenant_id dans les metadata du webhook FedaPay.',
      });
    }

    try {
      // On bill as the system superadmin (origin 'FEDAPAY').
      await subscriptionsService.activatePro(tenantId, billingType, '00000000-0000-0000-0000-000000000000', request.ip, request.headers['user-agent'] || '', 'FEDAPAY');
      return reply.status(200).send({ success: true, data: { transaction_id: result.transaction_id } });
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      const code = (err as any).code || 'SERVER_ERROR';
      return reply.status(statusCode).send({ success: false, error: code, message: (err as Error).message });
    }
  });
}
