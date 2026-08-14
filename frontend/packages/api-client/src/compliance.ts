/**
 * Compliance / DPO (§28 / portal §35.21) — admin-web `/compliance`.
 * Permissions: `audit.read` (overview), `compliance.manage` (policies + breaches).
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

export type PolicyStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'REJECTED';

export type BreachSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BreachStatus =
  | 'REPORTED'
  | 'INVESTIGATING'
  | 'CONTAINED'
  | 'CLOSED';

export type PolicyDocument = {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  category: string;
  summary?: string | null;
  body: string;
  version: number;
  status: PolicyStatus | string;
  approvalInstanceId?: string | null;
  createdBy: string;
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DataBreachCase = {
  id: string;
  organizationId: string;
  referenceCode: string;
  title: string;
  description: string;
  severity: BreachSeverity | string;
  status: BreachStatus | string;
  discoveredAt: string;
  reportedAt: string;
  affectedDataCategories?: string | null;
  estimatedRecords?: number | null;
  containmentNotes?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePolicyBody = {
  code: string;
  title: string;
  category: string;
  summary?: string;
  body: string;
};

export type CreateBreachBody = {
  title: string;
  description: string;
  severity: BreachSeverity;
  discoveredAt: string;
  affectedDataCategories?: string;
  estimatedRecords?: number;
};

export type ConsentStatus = 'ACTIVE' | 'WITHDRAWN' | 'EXPIRED';
export type ConsentSubjectType =
  | 'EMPLOYEE'
  | 'GUARD'
  | 'CUSTOMER_EMPLOYEE'
  | 'VISITOR'
  | 'APPLICANT'
  | 'SUPPLIER_CONTACT'
  | 'OTHER';
export type ConsentLawfulBasis =
  | 'CONSENT'
  | 'CONTRACT'
  | 'LEGAL_OBLIGATION'
  | 'VITAL_INTERESTS'
  | 'PUBLIC_TASK'
  | 'LEGITIMATE_INTERESTS';
export type ConsentChannel =
  | 'WEB_FORM'
  | 'PAPER'
  | 'EMAIL'
  | 'SMS'
  | 'IN_PERSON'
  | 'MOBILE_APP'
  | 'OTHER';

export type CatalogOption = { value: string; label: string };

export type ConsentRecord = {
  id: string;
  organizationId: string;
  referenceCode: string;
  subjectType: ConsentSubjectType | string;
  subjectName: string;
  subjectEmail?: string | null;
  subjectRef?: string | null;
  purpose: string;
  lawfulBasis: ConsentLawfulBasis | string;
  channel: ConsentChannel | string;
  status: ConsentStatus | string;
  grantedAt: string;
  expiresAt?: string | null;
  withdrawnAt?: string | null;
  withdrawnBy?: string | null;
  withdrawnByName?: string | null;
  withdrawReason?: string | null;
  notes?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateConsentBody = {
  subjectType: ConsentSubjectType;
  subjectName: string;
  subjectEmail?: string;
  subjectRef?: string;
  purpose: string;
  lawfulBasis: ConsentLawfulBasis;
  channel: ConsentChannel;
  grantedAt: string;
  expiresAt?: string;
  notes?: string;
};

export const listPolicies = (token?: string) =>
  coreFetch<PolicyDocument[]>('/api/v1/compliance/policies', { token });

export const createPolicy = (body: CreatePolicyBody, token?: string) =>
  coreFetch<PolicyDocument>('/api/v1/compliance/policies', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const getPolicy = (id: string, token?: string) =>
  coreFetch<PolicyDocument>(`/api/v1/compliance/policies/${id}`, { token });

export const updatePolicy = (
  id: string,
  body: Partial<CreatePolicyBody>,
  token?: string,
) =>
  coreFetch<PolicyDocument>(`/api/v1/compliance/policies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const submitPolicy = (id: string, token?: string) =>
  coreFetch<PolicyDocument>(`/api/v1/compliance/policies/${id}/submit`, {
    method: 'POST',
    body: '{}',
    token,
  });

export const approvePolicy = (id: string, token?: string) =>
  coreFetch<PolicyDocument>(`/api/v1/compliance/policies/${id}/approve`, {
    method: 'POST',
    body: '{}',
    token,
  });

export const rejectPolicy = (id: string, reason: string, token?: string) =>
  coreFetch<PolicyDocument>(`/api/v1/compliance/policies/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });

export const archivePolicy = (id: string, token?: string) =>
  coreFetch<PolicyDocument>(`/api/v1/compliance/policies/${id}/archive`, {
    method: 'POST',
    body: '{}',
    token,
  });

export const listBreaches = (token?: string) =>
  coreFetch<DataBreachCase[]>('/api/v1/compliance/breaches', { token });

export const createBreach = (body: CreateBreachBody, token?: string) =>
  coreFetch<DataBreachCase>('/api/v1/compliance/breaches', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const getBreach = (id: string, token?: string) =>
  coreFetch<DataBreachCase>(`/api/v1/compliance/breaches/${id}`, { token });

export const updateBreach = (
  id: string,
  body: {
    status?: BreachStatus;
    containmentNotes?: string;
    affectedDataCategories?: string;
    estimatedRecords?: number;
    title?: string;
    description?: string;
    severity?: BreachSeverity;
  },
  token?: string,
) =>
  coreFetch<DataBreachCase>(`/api/v1/compliance/breaches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });

export const listPolicyCategoryOptions = (token?: string) =>
  coreFetch<CatalogOption[]>('/api/v1/compliance/policy-category-options', {
    token,
  });

export const listConsentOptions = (token?: string) =>
  coreFetch<{
    purposes: CatalogOption[];
    subjectTypes: CatalogOption[];
    lawfulBases: CatalogOption[];
    channels: CatalogOption[];
  }>('/api/v1/compliance/consent-options', { token });

export const listConsents = (token?: string) =>
  coreFetch<ConsentRecord[]>('/api/v1/compliance/consents', { token });

export const createConsent = (body: CreateConsentBody, token?: string) =>
  coreFetch<ConsentRecord>('/api/v1/compliance/consents', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });

export const withdrawConsent = (
  id: string,
  reason: string,
  token?: string,
) =>
  coreFetch<ConsentRecord>(`/api/v1/compliance/consents/${id}/withdraw`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    token,
  });
