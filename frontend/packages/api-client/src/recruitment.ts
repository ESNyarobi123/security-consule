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

/** Public careers config — optional until backend ships. */
export type RecruitmentPublicConfig = {
  organizationId: string;
  /** Demo / seed OPEN posting id */
  seedPostingId?: string;
};

/** Public OPEN posting whitelist (no createdBy / applicant counts). */
export type OpenJobPosting = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  description: string;
  requirements?: string | null;
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
export async function listOpenJobPostings() {
  const res = await fetch(`${coreUrl()}/api/v1/recruitment/postings/open`);
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
