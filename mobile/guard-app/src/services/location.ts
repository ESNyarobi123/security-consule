import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { FALLBACK_GPS } from '@/constants/config';

const LAST_GPS_KEY = 'pssms.guard.lastGps';

/** Max age for using a previously cached fix when live GPS fails (30 min). */
const CACHED_MAX_AGE_MS = 30 * 60 * 1000;

export type GpsSource = 'live' | 'cached' | 'fallback_demo';

export type FieldGps = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  source: GpsSource;
  capturedAt: string;
};

type CachedGps = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

/**
 * Format a short status line for Duty / enqueue messages.
 * Live GPS is preferred; cached/fallback are honest for audit UX.
 */
export function formatGpsLabel(gps: FieldGps): string {
  const coords = `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`;
  if (gps.source === 'live') {
    const acc =
      gps.accuracyMeters != null
        ? ` ±${Math.round(gps.accuracyMeters)}m`
        : '';
    return `Live GPS ${coords}${acc}`;
  }
  if (gps.source === 'cached') {
    return `Cached GPS ${coords} (last fix)`;
  }
  return `Fallback demo GPS ${coords} (warehouse)`;
}

async function readCachedGps(): Promise<CachedGps | null> {
  const raw = await AsyncStorage.getItem(LAST_GPS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedGps;
    if (
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number' ||
      typeof parsed.capturedAt !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedGps(gps: CachedGps): Promise<void> {
  await AsyncStorage.setItem(LAST_GPS_KEY, JSON.stringify(gps));
}

/**
 * Resolve GPS for field events (clock / alertness / patrol).
 *
 * Preference order:
 * 1. Live foreground fix (Balanced accuracy)
 * 2. Last cached fix (≤ 30 min) when live fails or permission denied
 * 3. FALLBACK_GPS (SITE-WAREHOUSE-A demo) when allowFallback — honest source label
 *
 * Payroll still uses server-verified hours; lat/lng are field audit only.
 */
export async function getFieldGps(options?: {
  allowFallback?: boolean;
}): Promise<FieldGps> {
  const allowFallback = options?.allowFallback ?? true;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    const cached = await readCachedGps();
    if (cached && isFresh(cached.capturedAt)) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        accuracyMeters: cached.accuracyMeters,
        source: 'cached',
        capturedAt: cached.capturedAt,
      };
    }
    if (allowFallback) {
      return fallbackDemo();
    }
    throw new Error(
      'Location permission required for duty GPS. Enable it in system settings.',
    );
  }

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const capturedAt = new Date(
      pos.timestamp > 0 ? pos.timestamp : Date.now(),
    ).toISOString();
    const gps: FieldGps = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracyMeters:
        typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
      source: 'live',
      capturedAt,
    };
    await writeCachedGps({
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracyMeters: gps.accuracyMeters,
      capturedAt: gps.capturedAt,
    });
    return gps;
  } catch {
    const cached = await readCachedGps();
    if (cached && isFresh(cached.capturedAt)) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        accuracyMeters: cached.accuracyMeters,
        source: 'cached',
        capturedAt: cached.capturedAt,
      };
    }
    if (allowFallback) {
      return fallbackDemo();
    }
    throw new Error(
      'Could not get GPS fix. Move outdoors or try again with a clear sky view.',
    );
  }
}

function isFresh(capturedAt: string): boolean {
  const t = Date.parse(capturedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= CACHED_MAX_AGE_MS;
}

function fallbackDemo(): FieldGps {
  return {
    latitude: FALLBACK_GPS.latitude,
    longitude: FALLBACK_GPS.longitude,
    accuracyMeters: null,
    source: 'fallback_demo',
    capturedAt: new Date().toISOString(),
  };
}
