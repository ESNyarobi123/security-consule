/**
 * Assets admin — register, assign, pending ESS return confirm.
 * Permission: `assets.manage`. Portal: admin-web `/assets` + `/assets/returns`.
 */
import { authHeaders, clearSession, getRefreshToken, setTokens } from '@pssms/auth';

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

async function coreFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const doFetch = (access?: string | null) =>
    fetch(`${coreUrl()}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(access ?? token),
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

export type AssetStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'RETURN_PENDING'
  | 'MAINTENANCE'
  | 'DISPOSED';

export type ReturnCondition = 'GOOD' | 'DAMAGED' | 'LOST';

export type ActiveAssignmentSummary = {
  id: string;
  assignedToEmployeeId?: string | null;
  assignedToGuardId?: string | null;
  assignedAt: string;
};

export type Asset = {
  id: string;
  organizationId: string;
  assetTag: string;
  name: string;
  category?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  serialNumber?: string | null;
  status: AssetStatus | string;
  disposedAt?: string | null;
  disposedBy?: string | null;
  disposalReason?: string | null;
  maintenanceNotes?: string | null;
  createdAt: string;
  activeAssignment?: ActiveAssignmentSummary | null;
};

export type AssetLifecycleEventType =
  | 'TRANSFER'
  | 'DISPOSE'
  | 'MAINTENANCE_START'
  | 'MAINTENANCE_COMPLETE'
  | 'DAMAGE'
  | 'REPLACEMENT';

export type AssetLifecycleEvent = {
  id: string;
  organizationId: string;
  assetId: string;
  eventType: AssetLifecycleEventType | string;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  fromEmployeeId?: string | null;
  fromGuardId?: string | null;
  toEmployeeId?: string | null;
  toGuardId?: string | null;
  replacementAssetId?: string | null;
  condition?: string | null;
  createdAt: string;
  createdBy: string;
};

export type CategoryOption = {
  code: string;
  label: string;
};

export type CreateAssetBody = {
  assetTag: string;
  name: string;
  category?: string;
  serialNumber?: string;
  purchaseCost?: number;
  purchaseDate?: string;
};

export type AssignAssetBody = {
  assignedToEmployeeId?: string;
  assignedToGuardId?: string;
  notes?: string;
};

export type AssetAssignment = {
  id: string;
  organizationId: string;
  assetId: string;
  assignedToEmployeeId?: string | null;
  assignedToGuardId?: string | null;
  assignedAt: string;
  returnedAt?: string | null;
  notes?: string | null;
  assetTag?: string | null;
  assetName?: string | null;
  assetCategory?: string | null;
  assetStatus?: string | null;
};

export type AssetAssigneeOption = {
  id: string;
  employeeNumber: string;
  fullName: string;
};

export type AssetAssigneeOptions = {
  employees: AssetAssigneeOption[];
  guards: AssetAssigneeOption[];
};

export type PendingReturnAssignment = {
  id: string;
  organizationId: string;
  assetId: string;
  assignedToEmployeeId?: string | null;
  assignedToGuardId?: string | null;
  assignedAt: string;
  returnedAt?: string | null;
  notes?: string | null;
  returnRequestedAt?: string | null;
  returnRequestedBy?: string | null;
  returnCondition?: string | null;
  returnReceiptNote?: string | null;
  returnConfirmedBy?: string | null;
  returnConfirmedAt?: string | null;
  assetTag?: string | null;
  assetName?: string | null;
  assetCategory?: string | null;
  assetStatus?: string | null;
};

export type ConfirmReturnBody = {
  condition: ReturnCondition;
  receiptNote?: string;
};

export const listAssets = (token?: string) =>
  coreFetch<Asset[]>('/api/v1/assets', { token });

export const createAsset = (body: CreateAssetBody, token?: string) =>
  coreFetch<Asset>('/api/v1/assets', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const assignAsset = (
  assetId: string,
  body: AssignAssetBody,
  token?: string,
) =>
  coreFetch<AssetAssignment>(`/api/v1/assets/${assetId}/assign`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const listAssetAssigneeOptions = (token?: string) =>
  coreFetch<AssetAssigneeOptions>('/api/v1/assets/assignee-options', {
    token,
  });

export const listAssetCategoryOptions = (token?: string) =>
  coreFetch<CategoryOption[]>('/api/v1/assets/category-options', { token });

export const getAssetHistory = (assetId: string, token?: string) =>
  coreFetch<AssetLifecycleEvent[]>(`/api/v1/assets/${assetId}/history`, {
    token,
  });

export const transferAsset = (
  assetId: string,
  body: AssignAssetBody,
  token?: string,
) =>
  coreFetch<AssetAssignment>(`/api/v1/assets/${assetId}/transfer`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const disposeAsset = (
  assetId: string,
  body: { reason: string },
  token?: string,
) =>
  coreFetch<Asset>(`/api/v1/assets/${assetId}/dispose`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const startAssetMaintenance = (
  assetId: string,
  body: { notes?: string },
  token?: string,
) =>
  coreFetch<Asset>(`/api/v1/assets/${assetId}/maintenance/start`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const completeAssetMaintenance = (
  assetId: string,
  body: { notes?: string },
  token?: string,
) =>
  coreFetch<Asset>(`/api/v1/assets/${assetId}/maintenance/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const recordAssetDamage = (
  assetId: string,
  body: { notes: string; condition?: ReturnCondition },
  token?: string,
) =>
  coreFetch<AssetLifecycleEvent>(`/api/v1/assets/${assetId}/damage`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const recordAssetReplacement = (
  assetId: string,
  body: { replacementAssetId: string; notes?: string },
  token?: string,
) =>
  coreFetch<AssetLifecycleEvent>(`/api/v1/assets/${assetId}/replacement`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const walkInReturnAsset = (
  assetId: string,
  body: { condition?: ReturnCondition; receiptNote?: string },
  token?: string,
) =>
  coreFetch<AssetAssignment>(`/api/v1/assets/${assetId}/return`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const listPendingReturns = (token?: string) =>
  coreFetch<PendingReturnAssignment[]>(
    '/api/v1/assets/assignments/pending-returns',
    { token },
  );

export const confirmReturn = (
  assignmentId: string,
  body: ConfirmReturnBody,
  token?: string,
) =>
  coreFetch<PendingReturnAssignment>(
    `/api/v1/assets/assignments/${assignmentId}/confirm-return`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );
