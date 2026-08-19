/** Nest often returns JSON in Error.message — surface message clearly. */
export function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: { message?: string } | string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
      return parsed.error.message;
    }
  } catch {
    /* plain text */
  }
  return raw;
}

export const fieldCls =
  'rounded-md border border-[#e1dfdd] bg-white px-3 py-2 text-sm text-[#1b1a19] outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/15';
