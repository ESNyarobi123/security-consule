'use client';

import type { Device, DeviceEvent, DeviceType, EdgeGateway } from '@pssms/api-client';
import type { LucideIcon } from 'lucide-react';
import {
  Camera,
  Cpu,
  CreditCard,
  Fingerprint,
  Printer,
  QrCode,
  Radio,
  ScanBarcode,
  ScanFace,
} from 'lucide-react';
import type { ReactNode } from 'react';

/** Devices control room — navy / teal / sky / amber / rose (no purple glow). */
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

export type DevicesTab = 'devices' | 'gateways' | 'events';
export type StatusFilter = 'all' | 'online' | 'offline' | 'disabled';
export type RosterView = 'cards' | 'list';

export const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Online' },
  { id: 'offline', label: 'Offline' },
  { id: 'disabled', label: 'Disabled' },
];

export const TYPE_CHIPS: { label: string; types?: DeviceType[] }[] = [
  { label: 'Fingerprint', types: ['FINGERPRINT_SCANNER', 'BIOMETRIC_TERMINAL'] },
  { label: 'Face', types: ['FACE_TERMINAL'] },
  { label: 'RFID', types: ['RFID_READER', 'SMART_CARD_READER'] },
  { label: 'QR', types: ['QR_SCANNER', 'BARCODE_SCANNER'] },
  { label: 'Printer', types: ['PRINTER'] },
  { label: 'CCTV', types: ['CCTV_CAMERA'] },
];

export const KPI_TONES = {
  sky: {
    card: 'from-sky-500/25 to-sky-950/40 ring-sky-400/35',
    icon: 'bg-sky-400/25 text-sky-200',
    value: 'text-sky-50',
    bar: 'bg-sky-400',
  },
  emerald: {
    card: 'from-emerald-500/25 to-emerald-950/40 ring-emerald-400/35',
    icon: 'bg-emerald-400/25 text-emerald-200',
    value: 'text-emerald-50',
    bar: 'bg-emerald-400',
  },
  teal: {
    card: 'from-teal-500/25 to-teal-950/40 ring-teal-400/35',
    icon: 'bg-teal-400/25 text-teal-200',
    value: 'text-teal-50',
    bar: 'bg-teal-400',
  },
  rose: {
    card: 'from-rose-500/30 to-rose-950/40 ring-rose-400/35',
    icon: 'bg-rose-400/25 text-rose-200',
    value: 'text-rose-50',
    bar: 'bg-rose-400',
  },
  amber: {
    card: 'from-amber-500/30 to-amber-950/40 ring-amber-400/40',
    icon: 'bg-amber-400/25 text-amber-200',
    value: 'text-amber-50',
    bar: 'bg-amber-400',
  },
  slate: {
    card: 'from-slate-500/20 to-slate-950/40 ring-slate-400/25',
    icon: 'bg-slate-400/20 text-slate-200',
    value: 'text-slate-50',
    bar: 'bg-slate-400',
  },
} as const;

export type KpiTone = keyof typeof KPI_TONES;

const TYPE_META: Record<
  DeviceType,
  { label: string; short: string; Icon: LucideIcon }
> = {
  FINGERPRINT_SCANNER: {
    label: 'Fingerprint scanner',
    short: 'Fingerprint',
    Icon: Fingerprint,
  },
  BIOMETRIC_TERMINAL: {
    label: 'Biometric terminal',
    short: 'Biometric',
    Icon: Fingerprint,
  },
  FACE_TERMINAL: { label: 'Face terminal', short: 'Face', Icon: ScanFace },
  QR_SCANNER: { label: 'QR scanner', short: 'QR', Icon: QrCode },
  BARCODE_SCANNER: {
    label: 'Barcode scanner',
    short: 'Barcode',
    Icon: ScanBarcode,
  },
  PRINTER: { label: 'Printer', short: 'Printer', Icon: Printer },
  RFID_READER: { label: 'RFID reader', short: 'RFID', Icon: Radio },
  SMART_CARD_READER: {
    label: 'Smart card reader',
    short: 'Smart card',
    Icon: CreditCard,
  },
  CCTV_CAMERA: { label: 'CCTV camera', short: 'CCTV', Icon: Camera },
};

export function deviceTypeMeta(type: DeviceType | string) {
  return (
    TYPE_META[type as DeviceType] ?? {
      label: type.replace(/_/g, ' '),
      short: type.replace(/_/g, ' '),
      Icon: Cpu,
    }
  );
}

export function formatDeviceType(type: string): string {
  return deviceTypeMeta(type).label;
}

export function isDeviceOnline(status: string): boolean {
  return status === 'ONLINE';
}

export function isGatewayOnline(status: string): boolean {
  return status === 'ONLINE' || status === 'ACTIVE';
}

export function relativeTime(value?: string | null): string {
  if (!value) return 'never';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return '—';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function statusTone(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'ONLINE':
    case 'ACTIVE':
      return {
        label: status === 'ACTIVE' ? 'Active' : 'Online',
        className: 'bg-emerald-400/20 text-emerald-200 ring-emerald-400/30',
      };
    case 'OFFLINE':
      return {
        label: 'Offline',
        className: 'bg-amber-400/20 text-amber-200 ring-amber-400/30',
      };
    case 'DISABLED':
      return {
        label: 'Disabled',
        className: 'bg-slate-400/20 text-slate-300 ring-slate-400/25',
      };
    case 'PENDING':
      return {
        label: 'Pending',
        className: 'bg-sky-400/20 text-sky-200 ring-sky-400/30',
      };
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'bg-amber-400/20 text-amber-200 ring-amber-400/30',
      };
  }
}

export function eventStatusTone(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'PROCESSED':
      return {
        label: 'Processed',
        className: 'bg-emerald-400/20 text-emerald-200 ring-emerald-400/30',
      };
    case 'IGNORED':
      return {
        label: 'Ignored',
        className: 'bg-slate-400/20 text-slate-300 ring-slate-400/25',
      };
    case 'FAILED':
    case 'ERROR':
      return {
        label: status === 'ERROR' ? 'Error' : 'Failed',
        className: 'bg-rose-400/20 text-rose-200 ring-rose-400/30',
      };
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'bg-amber-400/20 text-amber-200 ring-amber-400/30',
      };
  }
}

/** Prefer API enrich (siteCode/siteName), then siteMap from listSites. */
export function resolveSiteLabel(
  row: { siteId?: string | null; siteCode?: string | null; siteName?: string | null },
  siteMap?: Map<string, string>,
): string | undefined {
  if (row.siteCode || row.siteName) {
    return [row.siteCode, row.siteName].filter(Boolean).join(' · ');
  }
  if (row.siteId && siteMap?.has(row.siteId)) return siteMap.get(row.siteId);
  return undefined;
}

export function matchesStatus(device: Device, filter: StatusFilter): boolean {
  switch (filter) {
    case 'online':
      return device.status === 'ONLINE';
    case 'offline':
      return device.status !== 'ONLINE' && device.status !== 'DISABLED';
    case 'disabled':
      return device.status === 'DISABLED';
    default:
      return true;
  }
}

export function matchesDeviceSearch(device: Device, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    device.code,
    device.name,
    device.type,
    device.connection,
    device.status,
    device.vendor,
    device.model,
    device.serialNumber,
    device.siteId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function matchesGatewaySearch(gw: EdgeGateway, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [gw.code, gw.name, gw.status, gw.version, gw.siteId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function deviceLabelForEvent(
  event: DeviceEvent,
  devices: Device[],
): string {
  const d = devices.find((x) => x.id === event.deviceId);
  return d ? `${d.code} · ${d.name}` : event.deviceId.slice(0, 8) + '…';
}

export function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: KpiTone;
  icon: ReactNode;
}) {
  const t = KPI_TONES[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${t.card} px-4 py-3.5 ring-1 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
    >
      <span
        className={`absolute left-0 top-0 h-full w-1 ${t.bar}`}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 pl-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {label}
        </p>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.icon}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-1.5 pl-1 text-2xl font-bold tracking-tight ${t.value}`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate pl-1 text-[11px] text-slate-400">{hint}</p>
    </div>
  );
}
