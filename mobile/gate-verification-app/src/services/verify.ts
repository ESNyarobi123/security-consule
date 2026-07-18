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

export type VisitorEntry = {
  id: string;
  organizationId: string;
  appointmentId?: string | null;
  siteId: string;
  gateId?: string | null;
  visitorName: string;
  result: VerificationResult;
  denyReason?: string | null;
  verifiedBy?: string | null;
  recordedAt: string;
  createdAt: string;
};

export type GateVerifyResponse = {
  allowed: boolean;
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
