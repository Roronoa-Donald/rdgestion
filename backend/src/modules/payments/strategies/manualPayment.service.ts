import { PaymentService, PaymentIntent, PaymentResult } from '../payment.service';

/**
 * Stratégie manuelle (no-op) : le mode manuel n'expose pas de paiement en ligne.
 * Tout passe par le SUPERADMIN. Toute opération en ligne jette 501.
 */
export class ManualPaymentService extends PaymentService {
  async createPaymentIntent(_input: {
    tenant_id: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    const err = new Error(
      'Le paiement en ligne n\'est pas disponible en mode manuel. L\'activation PRO est gérée par le Super Administrateur.'
    );
    (err as any).statusCode = 501;
    (err as any).code = 'METHOD_NOT_IMPLEMENTED';
    throw err;
  }

  async verifyWebhook(_payload: unknown, _signature: string): Promise<PaymentResult> {
    const err = new Error('Aucun webhook à vérifier en mode manuel.');
    (err as any).statusCode = 501;
    (err as any).code = 'METHOD_NOT_IMPLEMENTED';
    throw err;
  }

  async verifyTransaction(_transactionId: string): Promise<PaymentResult> {
    const err = new Error('Aucune vérification de transaction en mode manuel.');
    (err as any).statusCode = 501;
    (err as any).code = 'METHOD_NOT_IMPLEMENTED';
    throw err;
  }

  async refund(_transaction_id: string, _amount?: number): Promise<PaymentResult> {
    const err = new Error('Aucun remboursement possible en mode manuel.');
    (err as any).statusCode = 501;
    (err as any).code = 'METHOD_NOT_IMPLEMENTED';
    throw err;
  }
}
