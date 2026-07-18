/**
 * Local sync outbox statuses (mirror field/sync result + in-flight).
 * Server returns ACCEPTED | DUPLICATE | REJECTED; PENDING/SYNCING are client-only.
 */
export type OutboxStatus =
  | 'PENDING'
  | 'SYNCING'
  | 'ACCEPTED'
  | 'DUPLICATE'
  | 'REJECTED';

export type FieldEventType =
  | 'CLOCK_IN'
  | 'ALERTNESS_CONFIRM'
  | 'PATROL_SCAN'
  | 'CLOCK_OUT';

export type OutboxRow = {
  id: number;
  clientEventId: string;
  eventType: FieldEventType;
  deviceTime: string;
  payloadJson: string;
  status: OutboxStatus;
  serverId: string | null;
  serverMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueClockInInput = {
  clientEventId: string;
  deviceTime: string;
  siteId: string;
  latitude: number;
  longitude: number;
};

export type EnqueueAlertnessConfirmInput = {
  clientEventId: string;
  deviceTime: string;
  alertnessCheckId: string;
  latitude: number;
  longitude: number;
};

export type EnqueuePatrolScanInput = {
  clientEventId: string;
  deviceTime: string;
  siteId: string;
  checkpointId: string;
  qrOrNfcCode: string;
  latitude: number;
  longitude: number;
  method: 'QR';
};

export type EnqueueClockOutInput = {
  clientEventId: string;
  deviceTime: string;
  attendanceId: string;
  latitude: number;
  longitude: number;
};
