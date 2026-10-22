export type SmsProviderCode =
  | 'console'
  | 'fasthub'
  | 'beem'
  | 'nextsms'
  | 'africastalking'
  | 'twilio'
  | 'generic';

const KNOWN_PROVIDERS: SmsProviderCode[] = [
  'console',
  'fasthub',
  'beem',
  'nextsms',
  'africastalking',
  'twilio',
  'generic',
];

export type SmsTransport = {
  provider: SmsProviderCode;
  /** True only when a real vendor send can succeed (console is never live). */
  live: boolean;
  senderId: string;
};

/**
 * Single source of truth for the SMS transport, shared by:
 *  - `libs/notifications` (tells the approval UI whether the code is really
 *    going out or merely queued in console mode), and
 *  - `apps/integration-gateway` `SmsSender` (the actual HTTP call).
 *
 * Keeping the rules in one place means "SMS queued" can never disagree with
 * what the dispatcher will attempt.
 */
export function resolveSmsTransport(
  env: NodeJS.ProcessEnv = process.env,
): SmsTransport {
  const read = (name: string) => (env[name] ?? '').trim();
  const raw = read('SMS_PROVIDER').toLowerCase();
  const provider: SmsProviderCode = (KNOWN_PROVIDERS as string[]).includes(raw)
    ? (raw as SmsProviderCode)
    : raw
      ? 'console'
      : read('SMS_API_KEY')
        ? 'generic'
        : 'console';

  const key = Boolean(read('SMS_API_KEY'));
  let configured = key;
  if (provider === 'fasthub') {
    // FastHub authenticates with client_id + client_secret.
    configured = key && Boolean(read('SMS_API_SECRET'));
  } else if (provider === 'twilio') {
    configured = Boolean(read('SMS_ACCOUNT_SID')) && key;
  } else if (provider === 'generic') {
    configured = Boolean(read('SMS_API_URL')) && key;
  } else if (provider === 'africastalking') {
    configured = Boolean(read('SMS_USERNAME')) && key;
  } else if (provider === 'beem') {
    configured = key && Boolean(read('SMS_API_SECRET'));
  } else if (provider === 'nextsms') {
    configured = Boolean(read('SMS_USERNAME') || key);
  }

  return {
    provider,
    live: provider !== 'console' && configured,
    senderId: read('SMS_SENDER_ID') || 'HIGHLINK',
  };
}
