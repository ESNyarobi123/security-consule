import { apiRequest } from '@/services/api';
import {
  clearOpenAttendanceId,
  setOpenAttendanceId,
} from '@/services/duty-state';
import {
  applySyncResult,
  listSyncable,
  markSyncing,
  revertSyncingToPending,
} from '@/offline/outbox';

export type FieldSyncResult = {
  clientEventId: string;
  status: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED';
  serverId?: string;
  message?: string;
};

export type SyncSummary = {
  sent: number;
  results: FieldSyncResult[];
};

/**
 * Push PENDING/REJECTED outbox rows to core-api POST /field/sync.
 * Guard attendance only — never customers/access/payroll.
 */
export async function syncOutboxNow(): Promise<SyncSummary> {
  const rows = await listSyncable();
  if (rows.length === 0) {
    return { sent: 0, results: [] };
  }

  const byClientId = new Map(rows.map((r) => [r.clientEventId, r]));
  await markSyncing(rows.map((r) => r.id));

  try {
    const events = rows.map((r) => ({
      type: r.eventType,
      clientEventId: r.clientEventId,
      deviceTime: r.deviceTime,
      payload: JSON.parse(r.payloadJson) as Record<string, unknown>,
    }));

    const results = await apiRequest<FieldSyncResult[]>('/field/sync', {
      method: 'POST',
      body: { events },
    });

    for (const result of results) {
      await applySyncResult(
        result.clientEventId,
        result.status,
        result.serverId,
        result.message,
      );

      if (result.status === 'ACCEPTED' || result.status === 'DUPLICATE') {
        const row = byClientId.get(result.clientEventId);
        if (row?.eventType === 'CLOCK_IN' && result.serverId) {
          await setOpenAttendanceId(result.serverId);
        }
        if (row?.eventType === 'CLOCK_OUT') {
          await clearOpenAttendanceId();
        }
      }
    }

    // Any still SYNCING (missing from response) → PENDING
    await revertSyncingToPending();

    return { sent: events.length, results };
  } catch (err) {
    await revertSyncingToPending();
    throw err;
  }
}
