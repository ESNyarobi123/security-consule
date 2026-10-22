import { Injectable, Logger } from '@nestjs/common';
import {
  maskPhone,
  normalisePhone,
  phoneWithoutPlus,
  resolveSmsTransport,
  type SmsProviderCode,
} from '@pssms/shared';
import { v4 as uuidv4 } from 'uuid';

export interface SmsSendInput {
  recipient: string;
  body: string;
  correlationId?: string;
}

export interface SmsSendResult {
  messageId: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Real SMS delivery for gate codes / visitor alerts (Portal 35.10 · Module 12-C).
 *
 * Provider is chosen with `SMS_PROVIDER`; every vendor goes over HTTPS with the
 * same input/output contract so the dispatch service never changes:
 *
 *   console         dev only — logs the message, does NOT deliver
 *   fasthub         https://secure-gw.fasthub.co.tz/... (client_id + secret)
 *   beem            https://apisms.beem.africa/v1/send        (basic auth)
 *   nextsms         https://messaging.nextsms.co.tz/api/v1/send (basic auth)
 *   africastalking  https://api.africastalking.com/version1/messaging
 *   twilio          https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
 *   generic         POST `SMS_API_URL` with `{ to, message, sender }`
 *
 * A missing key or a non-2xx vendor response returns FAILED with the vendor
 * error, so the outbox retries and the delivery attempt row tells ops the truth
 * (nobody is told "sent" when the SMS was rejected).
 */
@Injectable()
export class SmsSender {
  private readonly logger = new Logger(SmsSender.name);

  get provider(): SmsProviderCode {
    return resolveSmsTransport().provider;
  }

  private get senderId(): string {
    return resolveSmsTransport().senderId;
  }

  get isConfigured(): boolean {
    return resolveSmsTransport().live;
  }

  health(): { status: 'UP' | 'DOWN' | 'DISABLED'; detail: string; code: string } {
    const p = this.provider;
    if (p === 'console') {
      return {
        status: 'UP',
        detail: 'console adapter — messages are logged only, not delivered',
        code: 'console-sms',
      };
    }
    if (!this.isConfigured) {
      return {
        status: 'DOWN',
        detail: `SMS_PROVIDER=${p} but credentials are incomplete`,
        code: `${p}-sms`,
      };
    }
    return { status: 'UP', detail: `${p} HTTP adapter ready`, code: `${p}-sms` };
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const provider = this.provider;
    const recipient = normalisePhone(input.recipient);
    if (!recipient) {
      return {
        messageId: uuidv4(),
        status: 'FAILED',
        provider,
        error: `INVALID_PHONE: "${input.recipient}" is not a usable mobile number`,
      };
    }

    if (provider === 'console') {
      const messageId = uuidv4();
      this.logger.log(
        `[SMS:console] to=${maskPhone(recipient)} correlation=${input.correlationId ?? '-'} body=${input.body}`,
      );
      return { messageId, status: 'SENT', provider: 'console-sms' };
    }

    if (!this.isConfigured) {
      return {
        messageId: uuidv4(),
        status: 'FAILED',
        provider,
        error: `SMS_PROVIDER=${provider} is missing credentials`,
      };
    }

    try {
      const sent = await this.sendWithProvider(provider, recipient, input);
      this.logger.log(
        `[SMS:${provider}] to=${maskPhone(recipient)} id=${sent.messageId}`,
      );
      return { messageId: sent.messageId, status: 'SENT', provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[SMS:${provider}] failed to=${maskPhone(recipient)}: ${message}`,
      );
      return {
        messageId: uuidv4(),
        status: 'FAILED',
        provider,
        error: message,
      };
    }
  }

  private async sendWithProvider(
    provider: SmsProviderCode,
    recipient: string,
    input: SmsSendInput,
  ): Promise<{ messageId: string }> {
    if (provider === 'fasthub') return this.sendFastHub(recipient, input);
    if (provider === 'beem') return this.sendBeem(recipient, input.body);
    if (provider === 'nextsms') return this.sendNextSms(recipient, input.body);
    if (provider === 'africastalking') {
      return this.sendAfricasTalking(recipient, input.body);
    }
    if (provider === 'twilio') return this.sendTwilio(recipient, input.body);
    return this.sendGeneric(recipient, input.body);
  }

  /**
   * FastHub Bulk SMS Gateway (Tanzania).
   *
   * The gateway takes the API `client_id` / `client_secret` in the legacy
   * `channel` object — that is what its credential check actually reads, even
   * though the vendor PDF labels the block `auth`. `reference` must be at least
   * 20 characters, so the correlation id is padded when callers pass a short id.
   */
  private async sendFastHub(recipient: string, input: SmsSendInput) {
    const clientId = this.env('SMS_API_KEY');
    const clientSecret = this.env('SMS_API_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('FastHub needs SMS_API_KEY (client_id) + SMS_API_SECRET');
    }
    const reference = this.fastHubReference(input.correlationId);
    const res = await this.postJson(
      this.env('SMS_API_URL') ??
        'https://secure-gw.fasthub.co.tz/fasthub/messaging/json/api',
      {
        channel: { channel: clientId, password: clientSecret },
        messages: [
          {
            text: input.body,
            msisdn: phoneWithoutPlus(recipient),
            source: this.senderId,
            reference,
          },
        ],
      },
      {},
    );
    const payload = (await this.readJson(res)) as {
      isSuccessful?: boolean;
      reference_id?: string;
      sms_quota?: number;
      error_description?: unknown;
      error_code?: number;
    };
    if (!res.ok || payload.isSuccessful !== true) {
      throw new Error(
        `FastHub rejected SMS (HTTP ${res.status}, code ${payload.error_code ?? '-'}): ${short(payload.error_description ?? payload)}`,
      );
    }
    return {
      messageId: String(payload.reference_id ?? `fasthub-${reference}`),
    };
  }

  /** Gateway requires >= 20 chars; keep the id deterministic per message. */
  private fastHubReference(correlationId?: string): string {
    const seed = (correlationId ?? uuidv4()).replace(/[^A-Za-z0-9-]/g, '');
    const prefixed = seed.startsWith('pssms-') ? seed : `pssms-${seed}`;
    return prefixed.length >= 20
      ? prefixed
      : `${prefixed}-${uuidv4()}`.slice(0, 36);
  }

  /** Beem Africa — POST /v1/send with basic auth api_key:secret_key. */
  private async sendBeem(recipient: string, body: string) {
    const key = this.env('SMS_API_KEY');
    const secret = this.env('SMS_API_SECRET');
    if (!secret) {
      throw new Error('SMS_API_SECRET is required for Beem Africa');
    }
    const res = await this.postJson(
      this.env('SMS_API_URL') ?? 'https://apisms.beem.africa/v1/send',
      {
        source_addr: this.senderId,
        schedule_time: '',
        encoding: 0,
        message: body,
        recipients: [
          { recipient_id: 1, dest_addr: phoneWithoutPlus(recipient) },
        ],
      },
      { Authorization: `Basic ${basic(key, secret)}` },
    );
    const payload = (await this.readJson(res)) as {
      successful?: boolean;
      request_id?: number | string;
      message?: string;
      code?: number;
    };
    const ok = res.ok && payload.successful !== false;
    if (!ok) {
      throw new Error(
        `Beem rejected SMS (HTTP ${res.status}, code ${payload.code ?? '-'}): ${payload.message ?? 'unknown error'}`,
      );
    }
    return {
      messageId: String(payload.request_id ?? `beem-${uuidv4()}`),
    };
  }

  /** NextSMS — POST /api/v1/send with basic auth username:password. */
  private async sendNextSms(recipient: string, body: string) {
    const key = this.env('SMS_API_KEY');
    const secret = this.env('SMS_API_SECRET') || this.env('SMS_PASSWORD');
    const res = await this.postJson(
      this.env('SMS_API_URL') ?? 'https://messaging.nextsms.co.tz/api/v1/send',
      {
        from: this.senderId,
        to: phoneWithoutPlus(recipient),
        text: body,
      },
      { Authorization: `Basic ${basic(this.env('SMS_USERNAME') || key, secret || key)}` },
    );
    const payload = await this.readJson(res);
    if (!res.ok) {
      throw new Error(`NextSMS rejected SMS (HTTP ${res.status}): ${short(payload)}`);
    }
    const id =
      (payload as { messageId?: string; id?: string }).messageId ??
      (payload as { id?: string }).id;
    return { messageId: id ?? `nextsms-${uuidv4()}` };
  }

  /** Africa's Talking — form-encoded POST, `apiKey` header. */
  private async sendAfricasTalking(recipient: string, body: string) {
    const username = this.env('SMS_USERNAME');
    if (!username) {
      throw new Error('SMS_USERNAME is required for Africa\'s Talking');
    }
    const form = new URLSearchParams({
      username,
      to: recipient,
      message: body,
      ...(process.env.SMS_SENDER_ID ? { from: this.senderId } : {}),
    });
    const res = await fetch(
      this.env('SMS_API_URL') ??
        'https://api.africastalking.com/version1/messaging',
      {
        method: 'POST',
        headers: {
          apiKey: this.env('SMS_API_KEY'),
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    const payload = await this.readJson(res);
    if (!res.ok) {
      throw new Error(
        `Africa's Talking rejected SMS (HTTP ${res.status}): ${short(payload)}`,
      );
    }
    const recipients = (
      payload as {
        SMSMessageData?: { Recipients?: Array<{ messageId?: string; status?: string }> };
      }
    )?.SMSMessageData?.Recipients ?? [];
    const first = recipients[0];
    if (first?.status && !/success/i.test(first.status)) {
      throw new Error(`Africa's Talking status: ${first.status}`);
    }
    return { messageId: first?.messageId ?? `at-${uuidv4()}` };
  }

  /** Twilio — form-encoded POST with account SID + auth token. */
  private async sendTwilio(recipient: string, body: string) {
    const sid = this.env('SMS_ACCOUNT_SID');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic(sid, this.env('SMS_API_KEY'))}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: recipient,
          From: this.senderId,
          Body: body,
        }).toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    const payload = await this.readJson(res);
    if (!res.ok) {
      throw new Error(`Twilio rejected SMS (HTTP ${res.status}): ${short(payload)}`);
    }
    const id = (payload as { sid?: string }).sid;
    return { messageId: id ?? `twilio-${uuidv4()}` };
  }

  /** Generic HTTP gateway — `{ to, message, sender }` + bearer token. */
  private async sendGeneric(recipient: string, body: string) {
    const url = this.env('SMS_API_URL');
    if (!url) throw new Error('SMS_API_URL is required for the generic provider');
    const headerName = this.env('SMS_AUTH_HEADER') || 'Authorization';
    const headerValue = this.env('SMS_AUTH_SCHEME')
      ? `${this.env('SMS_AUTH_SCHEME')} ${this.env('SMS_API_KEY')}`
      : `Bearer ${this.env('SMS_API_KEY')}`;
    const res = await this.postJson(
      url,
      {
        to: recipient,
        message: body,
        sender: this.senderId,
      },
      { [headerName]: headerValue },
    );
    const payload = await this.readJson(res);
    if (!res.ok) {
      throw new Error(
        `SMS gateway rejected message (HTTP ${res.status}): ${short(payload)}`,
      );
    }
    const id =
      (payload as { messageId?: string }).messageId ??
      (payload as { id?: string }).id ??
      (payload as { message_id?: string }).message_id;
    return { messageId: String(id ?? `generic-${uuidv4()}`) };
  }

  private async postJson(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  private async readJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { raw: text.slice(0, 500) };
    }
  }

  private env(name: string): string {
    return (process.env[name] ?? '').trim();
  }
}

function basic(user: string, pass: string): string {
  return Buffer.from(`${user}:${pass}`).toString('base64');
}

function short(payload: unknown): string {
  if (payload == null) return 'empty response';
  if (typeof payload === 'string') return payload.slice(0, 300);
  try {
    return JSON.stringify(payload).slice(0, 300);
  } catch {
    return String(payload);
  }
}
