import { env } from '../../config/env';
import { PaymentService } from './payment.service';
import { ManualPaymentService } from './strategies/manualPayment.service';
import { FedaPayPaymentService } from './strategies/fedaPayPayment.service';

/**
 * Factory : retourne le service de paiement selon la config env.
 * - PAYMENT_PROVIDER='fedapay' + FEDAPAY_API_KEY valide → FedaPayPaymentService.
 * - Sinon → ManualPaymentService (défaut).
 */
export function getPaymentService(): PaymentService {
  const provider = env.PAYMENT_PROVIDER;
  const apiKey = env.FEDAPAY_API_KEY;

  if (
    provider === 'fedapay' &&
    apiKey &&
    apiKey !== '' &&
    !apiKey.includes('YOUR_') &&
    !apiKey.includes('placeholder')
  ) {
    return new FedaPayPaymentService();
  }

  return new ManualPaymentService();
}

export const paymentService = getPaymentService();
