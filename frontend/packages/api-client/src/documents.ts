/**
 * Document attachments (MinIO metadata) — upload / list / presigned download.
 * Staff: `documents.manage` + parent perm. Portal: read-only on own Customer /
 * Contract / VisitorAppointment. Supplier portal may read+write own Supplier /
 * SupplierSubmission files (supplier cookie). Parking portal uses parking cookie.
 */
import {
  authHeaders,
  clearSession,
  getParkingToken,
  getRefreshToken,
  getSupplierToken,
  parkingAuthHeaders,
  setTokens,
  supplierAuthHeaders,
} from '@pssms/auth';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
};

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ?? 'http://localhost:4001';

async function parseEnvelope<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text());
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
}

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${coreUrl()}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiEnvelope<{
          accessToken: string;
          refreshToken: string;
        }>;
        setTokens(json.data.accessToken, json.data.refreshToken);
        return json.data.accessToken;
      } catch {
        return null;
      } finally {
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

async function resolveAuthHeaders(token?: string): Promise<HeadersInit> {
  if (token) return { Authorization: `Bearer ${token}` };
  const supplier = getSupplierToken();
  if (supplier) return supplierAuthHeaders(supplier);
  const parking = getParkingToken();
  if (parking) return parkingAuthHeaders(parking);
  return authHeaders();
}

async function coreFetch<T>(
  path: string,
  init: RequestInit & { token?: string; skipJsonContentType?: boolean } = {},
): Promise<T> {
  const { token, skipJsonContentType = false, ...rest } = init;
  const doFetch = async (access?: string | null) =>
    fetch(`${coreUrl()}${path}`, {
      ...rest,
      headers: {
        ...(skipJsonContentType || rest.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(await resolveAuthHeaders(access ?? token)),
        ...(rest.headers ?? {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const next = await tryRefresh();
    if (next) res = await doFetch(next);
    else {
      clearSession();
      throw new Error('Session expired');
    }
  }
  return parseEnvelope<T>(res);
}

export type DocumentObject = {
  id: string;
  organizationId: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  resourceType: string;
  resourceId: string;
  uploadedBy: string;
  checksum?: string | null;
  createdAt: string;
};

export type DocumentDownloadUrl = {
  url: string;
  expiresInSeconds: number;
  fileName: string;
  contentType: string;
};

export const listDocuments = (params: {
  resourceType: string;
  resourceId: string;
  token?: string;
}) => {
  const q = new URLSearchParams({
    resourceType: params.resourceType,
    resourceId: params.resourceId,
  });
  return coreFetch<DocumentObject[]>(`/api/v1/documents?${q.toString()}`, {
    token: params.token,
  });
};

export async function uploadDocument(params: {
  file: File;
  resourceType: string;
  resourceId: string;
  token?: string;
}): Promise<DocumentObject> {
  const body = new FormData();
  body.append('file', params.file);
  body.append('resourceType', params.resourceType);
  body.append('resourceId', params.resourceId);
  return coreFetch<DocumentObject>('/api/v1/documents/upload', {
    method: 'POST',
    body,
    skipJsonContentType: true,
    token: params.token,
  });
}

export const getDocumentDownloadUrl = (id: string, token?: string) =>
  coreFetch<DocumentDownloadUrl>(`/api/v1/documents/${id}/download-url`, {
    token,
  });
