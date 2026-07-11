import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from './payment.factory';
import { PaymentResult } from './payment.service';
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
  // FedaPay envoie les webhooks en POST avec :
  // - Header X-FEDAPAY-SIGNATURE : signature HMAC + timestamp (anti-replay)
  // - Body : l'objet Event FedaPay (name, data, id, created_at)
  //
  // Sécurité :
  // - Webhook.constructEvent() vérifie signature + timestamp
  // - Idempotence : on vérifie si l'event_id a déjà été traité
  // - On ne traite que transaction.approved
  fastify.post('/webhook/fedapay', {
    config: {
      // Désactiver le parsing automatique du body pour le webhook
      // (Webhook.constructEvent a besoin du body brut)
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = (request.headers['x-fedapay-signature'] as string) || '';

    let result: PaymentResult;
    try {
      result = await paymentService.verifyWebhook(request.body, signature);
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      const code = (err as any).code || 'SERVER_ERROR';
      console.error('❌ Webhook FedaPay rejeté :', (err as Error).message);
      return reply.status(statusCode).send({ success: false, error: code, message: (err as Error).message });
    }

    // Si le paiement n'est pas approuvé, on acquitte quand même (200)
    // pour éviter que FedaPay réessaie indéfiniment
    if (!result.success) {
      console.log('📨 Webhook FedaPay reçu mais non approuvé :', (result.raw_payload as any)?.event);
      return reply.status(200).send({ received: true, status: 'ignored' });
    }

    // Extraire tenant_id du custom_metadata
    const raw = (result.raw_payload || {}) as Record<string, unknown>;
    const data = (raw.data || {}) as Record<string, unknown>;
    const metadata = (data.custom_metadata || data.metadata || {}) as Record<string, unknown>;
    const tenantId = metadata.tenant_id as string | undefined;
    const billingType = (metadata.billing_type as 'MONTHLY' | 'LIFETIME') || 'MONTHLY';

    if (!tenantId) {
      console.error('❌ Webhook FedaPay sans tenant_id dans custom_metadata');
      return reply.status(400).send({
        success: false,
        error: 'WEBHOOK_MISSING_TENANT',
        message: 'Aucun tenant_id dans les custom_metadata du webhook FedaPay.',
      });
    }

    try {
      // Activation PRO (origin = 'FEDAPAY')
      await subscriptionsService.activatePro(
        tenantId,
        billingType,
        '00000000-0000-0000-0000-000000000000', // system user
        request.ip,
        request.headers['user-agent'] || '',
        'FEDAPAY'
      );

      console.log('✅ PRO activé pour', tenantId, 'via FedaPay');
      return reply.status(200).send({ success: true, data: { transaction_id: result.transaction_id } });
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      const code = (err as any).code || 'SERVER_ERROR';
      console.error('❌ Échec activation PRO webhook :', (err as Error).message);
      return reply.status(statusCode).send({ success: false, error: code, message: (err as Error).message });
    }
  });
}
