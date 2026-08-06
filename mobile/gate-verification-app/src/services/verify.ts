import { apiRequest } from '@/services/api';

export type VerificationResult =
  | 'ALLOWED'
  | 'DENIED_EXPIRED'
  | 'DENIED_INVALID'
  | 'DENIED_ALREADY_USED'
  | 'DENIED_REVOKED'
  | 'DENIED_GATE_MISMATCH'
  | 'DENIED_SITE_MISMATCH'
  | 'DENIED_BLACKLISTED'
  | string;

export type VisitorEntryDirection = 'IN' | 'OUT' | string;

export type VisitorIdType =
  | 'NIDA'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'OTHER'
  | string;

export type VisitorEntry = {
  id: string;
  organizationId: string;
  appointmentId?: string | null;
  siteId: string;
  gateId?: string | null;
  visitorName: string;
  result: VerificationResult;
  direction?: VisitorEntryDirection;
  denyReason?: string | null;
  verifiedBy?: string | null;
  recordedAt: string;
  createdAt: string;
  /** Module 12-D */
  idType?: VisitorIdType | null;
  idNumber?: string | null;
};

export type GateDenyHostNotified = {
  sms?: boolean;
  email?: boolean;
};

export type GateVerifyResponse = {
  allowed: boolean;
  result: VerificationResult;
  entry: VisitorEntry;
  /** Module 12-A — ops FieldAlert when denied */
  fieldAlertId?: string | null;
  /** Module 12-E — host SMS/EMAIL when deny matched appointment */
  hostNotified?: GateDenyHostNotified | null;
  /** Module 12-D — from matched appointment */
  idType?: VisitorIdType | null;
  idNumber?: string | null;
};

export type GateExitResponse = {
  allowed: boolean;
  exited: boolean;
  result: VerificationResult;
  entry: VisitorEntry;
};

export type VerifyGateCodeParams = {
  code: string;
  siteId: string;
  gateId: string;
  clientEventId: string;
  visitorPhone?: string;
};

export type ExitGateParams = {
  /** Plain verification code (works after entry use) or reference number */
  code: string;
  siteId: string;
  gateId: string;
  clientEventId: string;
};

/** POST /visitors/gate/verify — online-only; never queue or persist the code. */
export async function verifyGateCode(
  params: VerifyGateCodeParams,
): Promise<GateVerifyResponse> {
  const body: Record<string, string> = {
    code: params.code,
    siteId: params.siteId,
    gateId: params.gateId,
    clientEventId: params.clientEventId,
  };
  const phone = params.visitorPhone?.trim();
  if (phone) body.visitorPhone = phone;

  return apiRequest<GateVerifyResponse>('/visitors/gate/verify', {
    method: 'POST',
    body,
  });
}

/** POST /visitors/gate/exit — Module 12-B exit punch (code or reference). */
export async function exitGateVisitor(
  params: ExitGateParams,
): Promise<GateExitResponse> {
  const raw = params.code.trim();
  const looksLikeReference = /^VIS-/i.test(raw);
  const body: Record<string, string> = {
    siteId: params.siteId,
    gateId: params.gateId,
    clientEventId: params.clientEventId,
  };
  if (looksLikeReference) {
    body.referenceNumber = raw.toUpperCase();
  } else {
    body.verificationCode = raw.replace(/\s+/g, '').toUpperCase();
  }

  return apiRequest<GateExitResponse>('/visitors/gate/exit', {
    method: 'POST',
    body,
  });
}
