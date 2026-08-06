/**
 * Enterprise password policy (PSSMS requirement §5 — "password policy").
 * Returns the list of unmet rules; empty array means the password is acceptable.
 */
export interface PasswordPolicyOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireDigit?: boolean;
  requireSymbol?: boolean;
}

export type ResolvedPasswordPolicy = Required<PasswordPolicyOptions>;

export const DEFAULT_PASSWORD_POLICY: ResolvedPasswordPolicy = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
};

const MIN_LENGTH_FLOOR = 8;
const MIN_LENGTH_CEILING = 128;

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

/** Merge stored org JSON (or partial) onto enterprise defaults; clamp minLength. */
export function normalizePasswordPolicy(
  raw: unknown,
): ResolvedPasswordPolicy {
  const base =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  let minLength = DEFAULT_PASSWORD_POLICY.minLength;
  if (typeof base.minLength === 'number' && Number.isFinite(base.minLength)) {
    minLength = Math.trunc(base.minLength);
  }
  minLength = Math.min(
    MIN_LENGTH_CEILING,
    Math.max(MIN_LENGTH_FLOOR, minLength),
  );
  return {
    minLength,
    requireUppercase: asBool(
      base.requireUppercase,
      DEFAULT_PASSWORD_POLICY.requireUppercase,
    ),
    requireLowercase: asBool(
      base.requireLowercase,
      DEFAULT_PASSWORD_POLICY.requireLowercase,
    ),
    requireDigit: asBool(base.requireDigit, DEFAULT_PASSWORD_POLICY.requireDigit),
    requireSymbol: asBool(
      base.requireSymbol,
      DEFAULT_PASSWORD_POLICY.requireSymbol,
    ),
  };
}

export function evaluatePasswordPolicy(
  password: string,
  options: PasswordPolicyOptions = {},
): string[] {
  const opts = normalizePasswordPolicy(options);
  const failures: string[] = [];
  if (!password || password.length < opts.minLength) {
    failures.push(`at least ${opts.minLength} characters`);
  }
  if (opts.requireUppercase && !/[A-Z]/.test(password)) {
    failures.push('an uppercase letter');
  }
  if (opts.requireLowercase && !/[a-z]/.test(password)) {
    failures.push('a lowercase letter');
  }
  if (opts.requireDigit && !/[0-9]/.test(password)) {
    failures.push('a digit');
  }
  if (opts.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    failures.push('a symbol');
  }
  return failures;
}

export function isPasswordAcceptable(
  password: string,
  options: PasswordPolicyOptions = {},
): boolean {
  return evaluatePasswordPolicy(password, options).length === 0;
}

export function describePasswordPolicy(policy: ResolvedPasswordPolicy): string {
  const parts = [`min ${policy.minLength} chars`];
  if (policy.requireUppercase) parts.push('upper');
  if (policy.requireLowercase) parts.push('lower');
  if (policy.requireDigit) parts.push('digit');
  if (policy.requireSymbol) parts.push('symbol');
  return parts.join(', ');
}
