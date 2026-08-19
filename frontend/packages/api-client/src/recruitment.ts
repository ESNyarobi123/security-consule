import { authHeaders, clearSession, getRefreshToken, setTokens } from '@pssms/auth';

const coreUrl = () =>
  process.env.NEXT_PUBLIC_CORE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4001';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

function errorMessageFromBody(text: string, fallback: string): string {
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string | string[] };
      message?: string | string[];
    };
    const msg = json.error?.message ?? json.message;
    if (Array.isArray(msg)) return msg.join('; ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  } catch {
    /* not JSON */
  }
  return text.trim() || fallback;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(errorMessageFromBody(text, `Request failed (${res.status})`));
  }
  if (!text) throw new Error('Empty response from API');
  const json = JSON.parse(text) as ApiEnvelope<T>;
  if (json.success === false) {
    throw new Error(errorMessageFromBody(text, 'Request failed'));
  }
  return json.data;
}

export type ApplicantTrack = 'GUARD' | 'OFFICE' | 'GENERAL';

export const APPLICANT_TRACK_LABELS: Record<ApplicantTrack, string> = {
  GUARD: 'Guard applicant',
  OFFICE: 'Office staff',
  GENERAL: 'General role',
};

/** Public careers config — optional until backend ships. */
export type RecruitmentPublicConfig = {
  organizationId: string;
  /** Demo / seed OPEN posting id */
  seedPostingId?: string;
  applicantTracks?: Array<{ value: string; label: string; hint: string }>;
};

/** Public OPEN posting whitelist (no createdBy / applicant counts). */
export type OpenJobPosting = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  description: string;
  requirements?: string | null;
  applicantTrack?: ApplicantTrack | string;
  publishedAt?: string | null;
  closesAt?: string | null;
};

export type SubmitJobApplicationInput = {
  postingId: string;
  applicantName: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  coverLetter?: string;
};

/** Public apply receipt — no notes / employeeId. */
export type JobApplicationReceipt = {
  id: string;
  postingId: string;
  referenceNumber: string;
  status: string;
};

/** Safe status-by-ref subset — no name/phone/notes/resume. */
export type ApplicationStatusStage = {
  key: string;
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'skipped';
};

export type ApplicationStatusLookup = {
  referenceNumber: string;
  status: string;
  statusLabel: string;
  statusHint: string;
  postingTitle: string;
  department?: string | null;
  location?: string | null;
  submittedAt: string;
  stages: ApplicationStatusStage[];
  applicantTrack?: string;
  onboardingSteps?: Array<{ code: string; label: string; done: boolean }>;
};

/**
 * Optional backend helper — may 404 until implemented.
 * Callers may fall back to NEXT_PUBLIC_ORG_ID / NEXT_PUBLIC_POSTING_ID.
 */
export async function getRecruitmentPublicConfig(): Promise<RecruitmentPublicConfig | null> {
  try {
    const res = await fetch(`${coreUrl()}/api/v1/recruitment/public-config`);
    if (res.status === 404) return null;
    return parseEnvelope<RecruitmentPublicConfig>(res);
  } catch {
    return null;
  }
}

/** Public GET /recruitment/postings/open */
export async function listOpenJobPostings(track?: string) {
  const url = new URL(`${coreUrl()}/api/v1/recruitment/postings/open`);
  if (track && track !== 'ALL') url.searchParams.set('track', track);
  const res = await fetch(url.toString());
  return parseEnvelope<OpenJobPosting[]>(res);
}

/** Public GET /recruitment/postings/open/:id */
export async function getOpenJobPosting(id: string) {
  const res = await fetch(
    `${coreUrl()}/api/v1/recruitment/postings/open/${encodeURIComponent(id)}`,
  );
  return parseEnvelope<OpenJobPosting>(res);
}

/**
 * Public POST /recruitment/applications.
 * Send postingId + fields only — organization is resolved server-side.
 * Never call hire or PATCH status from this client.
 */
export async function submitJobApplication(body: SubmitJobApplicationInput) {
  const res = await fetch(`${coreUrl()}/api/v1/recruitment/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseEnvelope<JobApplicationReceipt>(res);
}

/** Public GET /recruitment/applications/status?reference=&email= */
export async function getApplicationStatus(reference: string, email: string) {
  const url = new URL(`${coreUrl()}/api/v1/recruitment/applications/status`);
  url.searchParams.set('reference', reference);
  url.searchParams.set('email', email);
  const res = await fetch(url.toString());
  return parseEnvelope<ApplicationStatusLookup>(res);
}

// ── Module 14-A — staff HR inbox (admin-web · recruitment.manage) ─────────

export type ApplicationStatusValue =
  | 'SUBMITTED'
  | 'SCREENING'
  | 'INTERVIEW'
  | 'OFFERED'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type StaffJobApplication = {
  id: string;
  organizationId: string;
  postingId: string;
  referenceNumber: string;
  applicantName: string;
  email: string;
  phone?: string | null;
  resumeUrl?: string | null;
  coverLetter?: string | null;
  status: ApplicationStatusValue;
  notes?: string | null;
  employeeId?: string | null;
  createdAt: string;
  postingTitle?: string | null;
  allowedNextStatuses?: ApplicationStatusValue[];
  canHire?: boolean;
  applicantTrack?: string | null;
  onboardingSteps?: Array<{
    code: string;
    label: string;
    done: boolean;
    completedAt?: string | null;
  }>;
  interviewNotification?: { email: boolean } | null;
};

export type StaffJobPosting = {
  id: string;
  organizationId: string;
  title: string;
  department?: string | null;
  location?: string | null;
  description: string;
  requirements?: string | null;
  applicantTrack?: string;
  status: string;
  publishedAt?: string | null;
  closesAt?: string | null;
  createdAt: string;
};

export type HireApplicantBody = {
  employeeNumber: string;
  department?: string;
  employmentType?: 'GUARD' | 'SUPERVISOR' | 'ADMIN' | 'OTHER';
};

let staffRefreshInFlight: Promise<string | null> | null = null;

async function tryStaffRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  if (!staffRefreshInFlight) {
    staffRefreshInFlight = (async () => {
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
          staffRefreshInFlight = null;
        }, 0);
      }
    })();
  }
  return staffRefreshInFlight;
}

async function recruitmentStaffFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const doFetch = (authToken?: string) =>
    fetch(`${coreUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(authToken ?? init?.token),
        ...init?.headers,
      },
    });

  let res = await doFetch();
  if (res.status === 401 && !init?.token) {
    const newToken = await tryStaffRefresh();
    if (newToken) res = await doFetch(newToken);
    if (res.status === 401 && typeof window !== 'undefined') {
      clearSession();
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }
  return parseEnvelope<T>(res);
}

/** GET /recruitment/applications — Module 14-A */
export function listStaffJobApplications(params?: {
  postingId?: string;
  status?: ApplicationStatusValue;
  token?: string;
}) {
  const q = new URLSearchParams();
  if (params?.postingId) q.set('postingId', params.postingId);
  if (params?.status) q.set('status', params.status);
  const qs = q.toString();
  return recruitmentStaffFetch<StaffJobApplication[]>(
    `/api/v1/recruitment/applications${qs ? `?${qs}` : ''}`,
    { token: params?.token },
  );
}

/** GET /recruitment/postings */
export function listStaffJobPostings(status?: string, token?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return recruitmentStaffFetch<StaffJobPosting[]>(
    `/api/v1/recruitment/postings${q}`,
    { token },
  );
}

/** PATCH /recruitment/applications/:id/onboarding */
export function updateJobApplicationOnboarding(
  id: string,
  body: { stepCode: string; done: boolean },
  token?: string,
) {
  return recruitmentStaffFetch<StaffJobApplication>(
    `/api/v1/recruitment/applications/${id}/onboarding`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    },
  );
}

/** PATCH /recruitment/applications/:id/status */
export function updateJobApplicationStatus(
  id: string,
  body: { status: ApplicationStatusValue; notes?: string },
  token?: string,
) {
  return recruitmentStaffFetch<StaffJobApplication>(
    `/api/v1/recruitment/applications/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    },
  );
}

/** POST /recruitment/applications/:id/hire */
export function hireJobApplicant(
  id: string,
  body: HireApplicantBody,
  token?: string,
) {
  return recruitmentStaffFetch<StaffJobApplication>(
    `/api/v1/recruitment/applications/${id}/hire`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    },
  );
}
