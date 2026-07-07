import crypto from 'crypto';
import { env } from '../../../config/env';
import { PaymentService, PaymentIntent, PaymentResult } from '../payment.service';

/**
 * Stub FedaPay (provider Mobile Money Afrique de l'Ouest).
 *
 * - createPaymentIntent : si FEDAPAY_API_KEY absent/placeholder → 503.
 *   Implémentation minimale : pour MVP on retourne un intent "pending" avec
 *   une reference `PAY-{timestamp}-{random}` et un checkout_url fictif.
 *   L'appel réel à l'API FedaPay est laissé en TODO (feature future).
 *
 * - verifyWebhook : valide la signature HMAC SHA256 de FedaPay (header `x-signature`)
 *   en comparant au FEDAPAY_API_SECRET (401 si invalide), puis vérifie
 *   `status === 'completed'` dans le payload.
 *
 * - refund : stub 501 pour MVP.
 */
export class FedaPayPaymentService extends PaymentService {
  private isConfigured(): boolean {
    const key = env.FEDAPAY_API_KEY;
    return !!key && key !== '' && !key.includes('placeholder') && !key.includes('change_moi');
  }

  async createPaymentIntent(input: {
    tenant_id: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    if (!this.isConfigured()) {
      const err = new Error(
        'Le provider de paiement FedaPay n\'est pas configuré. Définissez FEDAPAY_API_KEY dans les variables d\'environnement.'
      );
      (err as any).statusCode = 503;
      (err as any).code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
      throw err;
    }

    const currency = input.currency || 'XOF';
    const reference = `PAY-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // TODO: intégration réelle FedaPay.
    // POST https://api.fedapay.com/v1/payments
    //   Authorization: Bearer <FEDAPAY_API_KEY>
    //   body: { amount, currency: 'XOF', description, metadata }
    // Pour le MVP, on retourne un intent "pending" sans appel réseau.

    return {
      id: reference,
      amount: input.amount,
      currency,
      status: 'pending',
      reference,
      checkout_url: `https://api.fedapay.com/checkout/${reference}`,
    };
  }

  async verifyWebhook(payload: unknown, signature: string): Promise<PaymentResult> {
    const secret = env.FEDAPAY_API_SECRET;
    if (!secret) {
      const err = new Error('FEDAPAY_API_SECRET manquant : impossible de vérifier la signature du webhook.');
      (err as any).statusCode = 503;
      (err as any).code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
      throw err;
    }

    // Valider la signature HMAC SHA256 de FedaPay (header `x-signature`).
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      const err = new Error('Signature du webhook FedaPay invalide.');
      (err as any).statusCode = 401;
      (err as any).code = 'INVALID_SIGNATURE';
      throw err;
    }

    const data = (payload || {}) as Record<string, unknown>;
    const status = data.status as string | undefined;

    const result: PaymentResult = {
      success: status === 'completed',
      transaction_id: (data.id as string) || (data.transaction_id as string) || '',
      amount: (data.amount as number) || 0,
      currency: (data.currency as string) || 'XOF',
      reference: (data.reference as string) || '',
      raw_payload: payload,
    };

    if (!result.success) {
      const err = new Error(`Le paiement FedaPay n'est pas complété (status=${status || 'inconnu'}).`);
      (err as any).statusCode = 400;
      (err as any).code = 'PAYMENT_NOT_COMPLETED';
      throw err;
    }

    return result;
  }

  async refund(transaction_id: string, _amount?: number): Promise<PaymentResult> {
    // TODO: intégration réelle.
    // POST https://api.fedapay.com/v1/transactions/{id}/refund
    const err = new Error(`Remboursement FedaPay non implémenté pour le MVP (transaction ${transaction_id}).`);
    (err as any).statusCode = 501;
    (err as any).code = 'METHOD_NOT_IMPLEMENTED';
    throw err;
  }
}
