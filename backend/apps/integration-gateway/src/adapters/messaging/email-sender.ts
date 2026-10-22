import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface EmailSendInput {
  recipient: string;
  subject: string;
  body: string;
  correlationId?: string;
}

export interface EmailSendResult {
  messageId: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
}

/**
 * Email delivery for notifications.
 *
 * `EMAIL_PROVIDER=console` (default) logs the message — dev only.
 * `EMAIL_PROVIDER=generic` POSTs `{ to, subject, text }` to `EMAIL_API_URL`
 * with a bearer token, which is how transactional mail providers (Resend,
 * SendGrid, Mailgun, SES HTTP) are normally fronted.
 */
@Injectable()
export class EmailSender {
  private readonly logger = new Logger(EmailSender.name);

  get provider(): string {
    const raw = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
    if (!raw) return process.env.EMAIL_API_URL ? 'generic' : 'console';
    return raw;
  }

  get isConfigured(): boolean {
    if (this.provider === 'console') return true;
    return Boolean(process.env.EMAIL_API_URL?.trim());
  }

  health(): { status: 'UP' | 'DOWN'; detail: string; code: string } {
    const provider = this.provider;
    if (provider === 'console') {
      return {
        status: 'UP',
        detail: 'console adapter — emails are logged only, not delivered',
        code: 'console-email',
      };
    }
    if (!this.isConfigured) {
      return {
        status: 'DOWN',
        detail: `EMAIL_PROVIDER=${provider} but EMAIL_API_URL is missing`,
        code: `${provider}-email`,
      };
    }
    return { status: 'UP', detail: `${provider} HTTP adapter ready`, code: `${provider}-email` };
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const provider = this.provider;
    const recipient = input.recipient?.trim();
    if (!recipient || !recipient.includes('@')) {
      return {
        messageId: uuidv4(),
        status: 'FAILED',
        provider,
        error: `INVALID_EMAIL: "${input.recipient}"`,
      };
    }

    if (provider === 'console') {
      this.logger.log(
        `[EMAIL:console] to=${recipient} subject="${input.subject}" correlation=${input.correlationId ?? '-'}`,
      );
      return { messageId: uuidv4(), status: 'SENT', provider: 'console-email' };
    }

    if (!this.isConfigured) {
      return {
        messageId: uuidv4(),
        status: 'FAILED',
        provider,
        error: `EMAIL_PROVIDER=${provider} is missing EMAIL_API_URL`,
      };
    }

    try {
      const res = await fetch(process.env.EMAIL_API_URL!.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${process.env.EMAIL_API_KEY ?? ''}`,
        },
        body: JSON.stringify({
          to: recipient,
          from: process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? 'noreply@highlink.co.tz',
          subject: input.subject,
          text: input.body,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          messageId: uuidv4(),
          status: 'FAILED',
          provider,
          error: `Email gateway rejected message (HTTP ${res.status}): ${text.slice(0, 300)}`,
        };
      }
      let id = uuidv4();
      try {
        const parsed = JSON.parse(text) as { id?: string; messageId?: string };
        id = parsed.id ?? parsed.messageId ?? id;
      } catch {
        // non-JSON success body — keep generated id
      }
      return { messageId: id, status: 'SENT', provider };
    } catch (err) {
      return {
        messageId: uuidv4(),
        status: 'FAILED',
        provider,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
