import AsyncStorage from '@react-native-async-storage/async-storage';
import { newClientEventId } from '@/lib/uuid';
import { enqueuePatrolScan } from '@/offline/outbox';
import type { OutboxRow } from '@/offline/types';
import { apiRequest } from '@/services/api';
import {
  formatGpsLabel,
  getFieldGps,
  type FieldGps,
} from '@/services/location';
import { resolveDemoSite } from '@/services/sites';

export type CheckpointSummary = {
  id: string;
  siteId: string;
  code: string;
  name: string;
  qrCode?: string | null;
  nfcTagId?: string | null;
  isActive: boolean;
};

function checkpointsCacheKey(siteId: string): string {
  return `pssms.guard.checkpoints.${siteId}`;
}

export async function getCachedCheckpoints(
  siteId: string,
): Promise<CheckpointSummary[] | null> {
  const raw = await AsyncStorage.getItem(checkpointsCacheKey(siteId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheckpointSummary[];
  } catch {
    return null;
  }
}

export async function listCheckpoints(
  siteId: string,
  options?: { allowCache?: boolean },
): Promise<CheckpointSummary[]> {
  const allowCache = options?.allowCache ?? true;
  try {
    const rows = await apiRequest<CheckpointSummary[]>(
      `/operations/checkpoints?siteId=${encodeURIComponent(siteId)}`,
    );
    const list = Array.isArray(rows) ? rows : [];
    await AsyncStorage.setItem(
      checkpointsCacheKey(siteId),
      JSON.stringify(list),
    );
    return list;
  } catch (err) {
    if (allowCache) {
      const cached = await getCachedCheckpoints(siteId);
      if (cached) return cached;
    }
    throw err;
  }
}

export function resolveCheckpointByCode(
  checkpoints: CheckpointSummary[],
  code: string,
): CheckpointSummary | null {
  const needle = code.trim();
  if (!needle) return null;
  return (
    checkpoints.find(
      (cp) =>
        cp.qrCode === needle || cp.code === needle || cp.nfcTagId === needle,
    ) ?? null
  );
}

/**
 * Resolve checkpoint (online list or cache) and enqueue PATROL_SCAN.
 * Throws if offline with no cached checkpoint list for the site.
 * GPS prefers live fix; may use cached or warehouse fallback.
 */
export async function enqueuePatrolScanByCode(
  qrOrNfcCode: string,
): Promise<{
  row: OutboxRow;
  checkpoint: CheckpointSummary;
  gps: FieldGps;
}> {
  const site = await resolveDemoSite();
  let checkpoints: CheckpointSummary[];
  try {
    checkpoints = await listCheckpoints(site.id, { allowCache: true });
  } catch {
    throw new Error(
      'Checkpoint list not available offline. Open Patrol once while online to cache checkpoints.',
    );
  }

  if (checkpoints.length === 0) {
    throw new Error(
      'No checkpoints for this site. Open Patrol online once (seed CP-GATE-01).',
    );
  }

  const checkpoint = resolveCheckpointByCode(checkpoints, qrOrNfcCode);
  if (!checkpoint) {
    throw new Error(`No checkpoint matches code "${qrOrNfcCode.trim()}"`);
  }

  const gps = await getFieldGps({ allowFallback: true });

  const row = await enqueuePatrolScan({
    clientEventId: newClientEventId(),
    deviceTime: new Date().toISOString(),
    siteId: site.id,
    checkpointId: checkpoint.id,
    qrOrNfcCode: qrOrNfcCode.trim(),
    latitude: gps.latitude,
    longitude: gps.longitude,
    method: 'QR',
  });

  return { row, checkpoint, gps };
}

export { formatGpsLabel };
