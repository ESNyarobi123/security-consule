'use client';

import type { Device } from '@pssms/api-client';

export const VISION_URL =
  process.env.NEXT_PUBLIC_VISION_AI_URL ?? 'http://localhost:8000';

export const GRID_SIZES = [1, 4, 9, 16] as const;
export type GridSize = (typeof GRID_SIZES)[number];

export const CCTV_CONNECTIONS = ['ONVIF', 'NETWORK'] as const;

/** Security monitoring wall — navy / slate / amber (no purple AI glow). */
export const WALL = {
  bg: '#0a1628',
  bgSoft: '#0f2137',
  panel: '#12263f',
  border: 'rgba(148, 163, 184, 0.18)',
  borderStrong: 'rgba(148, 163, 184, 0.32)',
  text: '#e8eef6',
  muted: '#94a3b8',
  amber: '#f59e0b',
  online: '#34d399',
  offline: '#f87171',
  accent: '#0078d4',
} as const;

export function configStr(
  config: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const v = config?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Only allow http(s) embeds — never nest-proxied or javascript: URLs. */
export function safeHttpUrl(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export function cameraEmbedUrl(device: Device): string | undefined {
  const cfg = device.config ?? undefined;
  return (
    safeHttpUrl(configStr(cfg, 'embedUrl')) ??
    safeHttpUrl(configStr(cfg, 'streamUrl'))
  );
}

export function cameraSnapshotUrl(device: Device): string | undefined {
  return safeHttpUrl(configStr(device.config ?? undefined, 'snapshotUrl'));
}

export function cameraZone(device: Device): string | undefined {
  return configStr(device.config ?? undefined, 'zone');
}

export function isDeviceOnline(status: string): boolean {
  return status === 'ONLINE';
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function gridClass(size: GridSize): string {
  switch (size) {
    case 1:
      return 'grid-cols-1';
    case 4:
      return 'grid-cols-1 sm:grid-cols-2';
    case 9:
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    case 16:
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    default:
      return 'grid-cols-1 sm:grid-cols-2';
  }
}

export function eventTitle(payload: Record<string, unknown>): string {
  const keys = ['title', 'message', 'alert', 'label', 'summary', 'type'] as const;
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'CCTV AI alert';
}

export function eventSeverity(payload: Record<string, unknown>): string {
  const v = payload.severity ?? payload.level ?? payload.priority;
  return typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : 'INFO';
}
