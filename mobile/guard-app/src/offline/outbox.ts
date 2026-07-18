import { getDb } from './db';
import type {
  EnqueueAlertnessConfirmInput,
  EnqueueClockInInput,
  EnqueueClockOutInput,
  EnqueuePatrolScanInput,
  OutboxRow,
  OutboxStatus,
} from './types';

type SqlRow = {
  id: number;
  client_event_id: string;
  event_type: string;
  device_time: string;
  payload_json: string;
  status: string;
  server_id: string | null;
  server_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: SqlRow): OutboxRow {
  return {
    id: row.id,
    clientEventId: row.client_event_id,
    eventType: row.event_type as OutboxRow['eventType'],
    deviceTime: row.device_time,
    payloadJson: row.payload_json,
    status: row.status as OutboxStatus,
    serverId: row.server_id,
    serverMessage: row.server_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertEvent(
  clientEventId: string,
  eventType: OutboxRow['eventType'],
  deviceTime: string,
  payload: Record<string, unknown>,
): Promise<OutboxRow> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_outbox
      (client_event_id, event_type, device_time, payload_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
    [
      clientEventId,
      eventType,
      deviceTime,
      JSON.stringify(payload),
      now,
      now,
    ],
  );
  const row = await db.getFirstAsync<SqlRow>(
    'SELECT * FROM sync_outbox WHERE client_event_id = ?',
    [clientEventId],
  );
  if (!row) throw new Error(`Failed to read enqueued ${eventType}`);
  return mapRow(row);
}

export async function enqueueClockIn(
  input: EnqueueClockInInput,
): Promise<OutboxRow> {
  return insertEvent(input.clientEventId, 'CLOCK_IN', input.deviceTime, {
    siteId: input.siteId,
    method: 'MOBILE_GPS',
    gps: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });
}

export async function enqueueAlertnessConfirm(
  input: EnqueueAlertnessConfirmInput,
): Promise<OutboxRow> {
  return insertEvent(
    input.clientEventId,
    'ALERTNESS_CONFIRM',
    input.deviceTime,
    {
      alertnessCheckId: input.alertnessCheckId,
      method: 'MOBILE_GPS',
      gps: {
        latitude: input.latitude,
        longitude: input.longitude,
      },
    },
  );
}

export async function enqueuePatrolScan(
  input: EnqueuePatrolScanInput,
): Promise<OutboxRow> {
  return insertEvent(input.clientEventId, 'PATROL_SCAN', input.deviceTime, {
    siteId: input.siteId,
    checkpointId: input.checkpointId,
    method: input.method,
    qrOrNfcCode: input.qrOrNfcCode,
    gps: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });
}

export async function enqueueClockOut(
  input: EnqueueClockOutInput,
): Promise<OutboxRow> {
  return insertEvent(input.clientEventId, 'CLOCK_OUT', input.deviceTime, {
    attendanceId: input.attendanceId,
    method: 'MOBILE_GPS',
    gps: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });
}

export async function listOutbox(): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SqlRow>(
    'SELECT * FROM sync_outbox ORDER BY id DESC',
  );
  return rows.map(mapRow);
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM sync_outbox WHERE status IN ('PENDING', 'SYNCING', 'REJECTED')`,
  );
  return row?.c ?? 0;
}

export async function listSyncable(): Promise<OutboxRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SqlRow>(
    `SELECT * FROM sync_outbox
     WHERE status IN ('PENDING', 'REJECTED')
     ORDER BY id ASC`,
  );
  return rows.map(mapRow);
}

export async function markSyncing(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE sync_outbox SET status = 'SYNCING', updated_at = ? WHERE id IN (${placeholders})`,
    [now, ...ids],
  );
}

export async function applySyncResult(
  clientEventId: string,
  status: Extract<OutboxStatus, 'ACCEPTED' | 'DUPLICATE' | 'REJECTED'>,
  serverId?: string,
  message?: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_outbox
     SET status = ?, server_id = COALESCE(?, server_id), server_message = ?, updated_at = ?
     WHERE client_event_id = ?`,
    [status, serverId ?? null, message ?? null, now, clientEventId],
  );
}

export async function revertSyncingToPending(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_outbox SET status = 'PENDING', updated_at = ? WHERE status = 'SYNCING'`,
    [now],
  );
}
