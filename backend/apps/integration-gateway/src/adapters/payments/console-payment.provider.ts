import { Injectable, Logger } from '@nestjs/common';

export interface PaymentWebhookPayload {
  invoiceId?: string;
  amount?: number;
  paymentReference?: string;
  organizationId?: string;
  externalId?: string;
}

@Injectable()
export class ConsolePaymentProvider {
  private readonly logger = new Logger(ConsolePaymentProvider.name);

  parseWebhook(body: unknown): PaymentWebhookPayload {
    const payload = body as PaymentWebhookPayload;
    this.logger.log(`[PAYMENT WEBHOOK] ${JSON.stringify(payload)}`);
    return payload;
  }
}
