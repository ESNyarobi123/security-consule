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

const DEFAULTS: Required<PasswordPolicyOptions> = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
};

export function evaluatePasswordPolicy(
  password: string,
  options: PasswordPolicyOptions = {},
): string[] {
  const opts = { ...DEFAULTS, ...options };
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
