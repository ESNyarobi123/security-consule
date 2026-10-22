export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string | string[];
    details?: unknown;
  };
  message?: string | string[];
};

/**
 * Turn an API error body into a human-readable message.
 *
 * The core API wraps every failure as
 * `{ success: false, error: { code, message, details } }`. Validation DTO
 * problems live in `details` while `message` is just "Validation failed", so
 * surfacing `details` is what makes the message useful in a portal toast.
 * A raw JSON envelope must never be shown to an operator.
 */
export function errorMessageFromBody(text: string, fallback: string): string {
  try {
    const json = JSON.parse(text) as ApiErrorBody;
    const primary = json.error?.message ?? json.message;
    const base = Array.isArray(primary)
      ? primary.join('; ')
      : typeof primary === 'string' && primary.trim()
        ? primary
        : '';
    const details = json.error?.details;
    const extra = Array.isArray(details)
      ? details.filter((d): d is string => typeof d === 'string' && !!d.trim())
      : typeof details === 'string' && details.trim()
        ? [details]
        : [];
    // Avoid repeating "Validation failed: Validation failed".
    const unique = extra.filter((d) => d !== base);
    if (base && unique.length) return `${base}: ${unique.join('; ')}`;
    if (base) return base;
    if (unique.length) return unique.join('; ');
  } catch {
    /* not JSON */
  }
  return text.trim() || fallback;
}

export type ApiError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

export async function parseApiEnvelope<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(
      errorMessageFromBody(text, `Request failed (${res.status})`),
    ) as ApiError;
    err.status = res.status;
    try {
      const json = JSON.parse(text) as ApiErrorBody;
      err.code = json.error?.code;
      err.details = json.error?.details;
    } catch {
      /* not JSON */
    }
    throw err;
  }
  // A void endpoint (204 or bare 200) is still a success; callers that expect a
  // payload simply get `undefined` instead of a bogus "empty response" failure.
  if (!text.trim()) return undefined as T;
  const json = JSON.parse(text) as ApiEnvelope<T> & { error?: ApiErrorBody['error'] };
  if (json.success === false) {
    const err = new Error(
      errorMessageFromBody(text, 'Request failed'),
    ) as ApiError;
    err.status = res.status;
    err.code = json.error?.code;
    err.details = json.error?.details;
    throw err;
  }
  return json.data;
}
