import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from './payment.factory';
import { PaymentResult } from './payment.service';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { subscriptionsService } from '../admin/admin.service';
import { query } from '../../config/database';

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
  // ─── Capturer le raw body pour la vérification webhook FedaPay ──
  // Webhook.constructEvent() a besoin du body brut (string) pour vérifier
  // la signature HMAC. Fastify parse le body en JSON par défaut, ce qui
  // modifie le format (key ordering, whitespace) et invalide la signature.
  // On stocke donc le raw body dans request.rawBody pour le webhook.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req: FastifyRequest, body: string, done: (err: Error | null, body?: unknown) => void) => {
      try {
        (req as any).rawBody = body;
        const json = JSON.parse(body);
        done(null, json);
      } catch (err: any) {
        done(err);
      }
    }
  );

  // ─── Création d'un intent de paiement (ADMIN) ───────────────
  fastify.post('/create-intent', {
    schema: {
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 1 },
          description: { type: 'string' },
          billing_type: { type: 'string', enum: ['MONTHLY', 'LIFETIME'] },
        },
        additionalProperties: false,
      },
    },
    preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive],
  }, async (request: FastifyRequest<any>, reply: FastifyReply) => {
    try {
      const body = request.body as { amount: number; description?: string; billing_type?: 'MONTHLY' | 'LIFETIME' };
      const intent = await paymentService.createPaymentIntent({
        tenant_id: request.currentUser!.tenantId,
        amount: body.amount,
        description: body.description,
        metadata: {
          tenant_id: request.currentUser!.tenantId,
          user_id: request.currentUser!.userId,
          billing_type: body.billing_type || 'MONTHLY',
        },
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
    // Webhook FedaPay — on utilise le raw body capturé par le content type
    // parser ci-dessus pour vérifier la signature HMAC.
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = (request.headers['x-fedapay-signature'] as string) || '';

    // Utiliser le raw body (string brute) pour la vérification de signature
    const rawBody = (request as any).rawBody || request.body;

    let result: PaymentResult;
    try {
      result = await paymentService.verifyWebhook(rawBody, signature);
    } catch (err) {
      const statusCode = (err as any).statusCode || 500;
      const code = (err as any).code || 'SERVER_ERROR';
      console.error('❌ Webhook FedaPay rejeté :', (err as Error).message);
      return reply.status(statusCode).send({ success: false, error: code, message: (err as Error).message });
    }

    // Si le paiement n'est pas approuvé, on acquitte quand même (200)
    // pour éviter que FedaPay réessaie indéfiniment
    if (!result.success) {
      console.log('📨 Webhook FedaPay reçu mais non approuvé :', (result.raw_payload as any)?.name);
      return reply.status(200).send({ received: true, status: 'ignored' });
    }

    // Extraire tenant_id du custom_metadata
    const raw = (result.raw_payload || {}) as Record<string, unknown>;
    const data = (raw.data || {}) as Record<string, unknown>;
    const metadata = (data.custom_metadata || data.metadata || {}) as Record<string, unknown>;
    const tenantId = metadata.tenant_id as string | undefined;
    const billingType = (metadata.billing_type as 'MONTHLY' | 'LIFETIME') || 'MONTHLY';
    const eventId = (raw.id as string) || '';

    if (!tenantId) {
      console.error('❌ Webhook FedaPay sans tenant_id dans custom_metadata');
      return reply.status(400).send({
        success: false,
        error: 'WEBHOOK_MISSING_TENANT',
        message: 'Aucun tenant_id dans les custom_metadata du webhook FedaPay.',
      });
    }

    // Idempotency check: verify this event hasn't already been processed
    if (eventId) {
      const existing = await query(
        'SELECT id FROM payments WHERE event_id = $1 LIMIT 1',
        [eventId]
      );
      if (existing.rows.length > 0) {
        console.log('🔄 Webhook FedaPay déjà traité, event_id:', eventId);
        return reply.status(200).send({ success: true, data: { duplicate: true } });
      }

      // Record the payment event for idempotency
      await query(
        `INSERT INTO payments (tenant_id, provider, transaction_id, event_id, amount, currency, status, raw_payload)
         VALUES ($1, 'FEDAPay', $2, $3, $4, $5, 'approved', $6)
         ON CONFLICT (event_id) DO NOTHING`,
        [tenantId, result.transaction_id, eventId, result.amount, result.currency, JSON.stringify(raw)]
      );
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
