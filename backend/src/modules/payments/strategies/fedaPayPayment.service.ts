import { env } from '../../../config/env';
import { PaymentService, PaymentIntent, PaymentResult } from '../payment.service';
import { FedaPay, Transaction, Webhook } from 'fedapay';

/**
 * Service de paiement FedaPay — intégration réelle avec le SDK officiel.
 *
 * Flux :
 * 1. createPaymentIntent() → Transaction.create() via l'API FedaPay sandbox/live
 * 2. L'utilisateur est redirigé vers token.url (page de paiement FedaPay)
 * 3. FedaPay envoie un webhook à /api/payments/webhook/fedapay
 * 4. verifyWebhook() valide la signature avec Webhook.constructEvent()
 * 5. Si transaction.approved → activation PRO automatique
 *
 * Sécurité :
 * - Webhook.constructEvent() vérifie la signature HMAC + timestamp (anti-replay)
 * - Idempotence : on vérifie si l'event a déjà été traité (event_id dans payments)
 * - TLS 1.2+ requis par FedaPay
 * - Clé secrète jamais exposée côté client (checkout via token.url)
 */

export class FedaPayPaymentService extends PaymentService {
  private configured = false;

  constructor() {
    super();
    const apiKey = env.FEDAPAY_API_KEY;
    if (apiKey && apiKey !== '' && !apiKey.includes('YOUR_') && !apiKey.includes('placeholder')) {
      FedaPay.setApiKey(apiKey);
      FedaPay.setEnvironment(env.FEDAPAY_ENVIRONMENT || 'sandbox');
      this.configured = true;
      console.log('💳 FedaPay configuré :', env.FEDAPAY_ENVIRONMENT, '(clé:', apiKey.substring(0, 8) + '...)');
    } else {
      console.warn('⚠️  FedaPay non configuré — FEDAPAY_API_KEY manquante ou placeholder.');
    }
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      const err = new Error(
        'Le provider de paiement FedaPay n\'est pas configuré. ' +
        'Définissez FEDAPAY_API_KEY, FEDAPAY_ENVIRONMENT dans les variables d\'environnement.'
      );
      (err as any).statusCode = 503;
      (err as any).code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
      throw err;
    }
  }

  /**
   * Crée une transaction FedaPay et retourne l'URL de paiement.
   *
   * @param input.tenant_id - ID du tenant qui paie
   * @param input.amount - Montant en FCFA (entier)
   * @param input.description - Description (ex: "Abonnement PRO Mensuel")
   * @param input.metadata - custom_metadata FedaPay (tenant_id, billing_type, etc.)
   */
  async createPaymentIntent(input: {
    tenant_id: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    this.ensureConfigured();

    const currency = input.currency || 'XOF';
    const description = input.description || `Abonnement PRO — ${input.tenant_id.substring(0, 8)}`;

    // Déterminer le callback_url : toujours utiliser l'URL Vercel en production
    const isProduction = env.NODE_ENV === 'production' || !!process.env.VERCEL;
    const baseUrl = isProduction
      ? 'https://rdgestion.vercel.app'
      : (env.CORS_ORIGIN || 'http://localhost:8080');

    // Créer la transaction via l'API FedaPay
    const transaction = await Transaction.create({
      description,
      amount: input.amount,
      currency: { iso: currency },
      callback_url: `${baseUrl}/#/settings?payment=done`,
      custom_metadata: {
        tenant_id: input.tenant_id,
        ...input.metadata,
      },
    });

    // Générer le token de paiement (URL de checkout)
    const token = await transaction.generateToken();

    return {
      id: String(transaction.id),
      amount: input.amount,
      currency,
      status: 'pending',
      reference: String(transaction.reference || transaction.id),
      checkout_url: token.url,
    };
  }

  /**
   * Vérifie la signature d'un webhook FedaPay avec le SDK officiel.
   *
   * Sécurité :
   * - Webhook.constructEvent() vérifie X-FEDAPAY-SIGNATURE (HMAC + timestamp)
   * - Protection anti-replay : timestamp trop ancien → rejeté
   * - Retourne le statut réel de la transaction
   */
  async verifyWebhook(payload: unknown, signature: string): Promise<PaymentResult> {
    const webhookSecret = env.FEDAPAY_WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret.includes('YOUR_')) {
      const err = new Error('FEDAPAY_WEBHOOK_SECRET manquant ou placeholder.');
      (err as any).statusCode = 503;
      (err as any).code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
      throw err;
    }

    // ConstructEvent valide la signature + timestamp automatiquement
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    let event: any;
    try {
      event = Webhook.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      const error = new Error(`Signature webhook FedaPay invalide : ${err.message}`);
      (error as any).statusCode = 401;
      (error as any).code = 'INVALID_SIGNATURE';
      throw error;
    }

    const data = event.data || {};
    const eventName = event.name as string;

    // On ne traite que les transactions approuvées
    const success = eventName === 'transaction.approved';

    return {
      success,
      transaction_id: String(data.id || ''),
      amount: Number(data.amount) || 0,
      currency: String(data.currency?.iso || 'XOF'),
      reference: String(data.reference || data.id || ''),
      raw_payload: { event: eventName, data },
    };
  }

  /**
   * Remboursement FedaPay (non implémenté pour le MVP).
   */
  async refund(transaction_id: string, _amount?: number): Promise<PaymentResult> {
    const err = new Error(`Remboursement FedaPay non implémenté (transaction ${transaction_id}).`);
    (err as any).statusCode = 501;
    (err as any).code = 'METHOD_NOT_IMPLEMENTED';
    throw err;
  }
}
