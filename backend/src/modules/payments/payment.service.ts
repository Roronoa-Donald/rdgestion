export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
  reference: string;
  checkout_url?: string;
}

export interface PaymentResult {
  success: boolean;
  transaction_id: string;
  amount: number;
  currency: string;
  reference: string;
  raw_payload?: unknown;
}

export abstract class PaymentService {
  abstract createPaymentIntent(input: {
    tenant_id: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent>;
  abstract verifyWebhook(payload: unknown, signature: string): Promise<PaymentResult>;
  abstract verifyTransaction(transactionId: string): Promise<PaymentResult>;
  abstract refund(transaction_id: string, amount?: number): Promise<PaymentResult>;
}
