import { getApiBase } from '@/constants/config';
import { getAccessToken } from '@/services/auth-store';

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: { requestId?: string; timestamp?: string };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  let token = options.token;
  if (auth && token === undefined) {
    token = await getAccessToken();
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof json === 'object' &&
      json &&
      'message' in json &&
      typeof (json as { message: unknown }).message === 'string'
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json);
  }

  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json
  ) {
    return (json as ApiEnvelope<T>).data;
  }
  return json as T;
}
