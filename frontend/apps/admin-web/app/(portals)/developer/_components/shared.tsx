'use client';

import type {
  DeviceType,
  PlatformServiceHealth,
  ProviderAdapterHealth,
} from '@pssms/api-client';
import { GlassCard, StatusBadge } from '@pssms/ui';
import {
  Camera,
  CreditCard,
  Fingerprint,
  HardDrive,
  Mail,
  MessageCircle,
  MessageSquare,
  Plug,
  QrCode,
  Radio,
  ScanFace,
  Smartphone,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

export const isOnline = (status?: string) =>
  !!status && !['down', 'DOWN', 'DISABLED'].includes(status);

export const serviceBadge = (status?: string): string =>
  status === undefined
    ? 'PENDING'
    : isOnline(status)
      ? 'ACTIVE'
      : 'SUSPENDED';

export const adapterBadge = (status?: string): string => {
  if (!status) return 'PENDING';
  if (status === 'UP') return 'ACTIVE';
  if (status === 'DISABLED') return 'DRAFT';
  return 'SUSPENDED';
};

export const SERVICE_LABELS: Record<string, string> = {
  'core-api': 'Core API',
  'api-gateway': 'API Gateway',
  'background-worker': 'Background Worker',
  'integration-gateway': 'Integration Gateway',
  'realtime-gateway': 'Realtime Gateway',
  'reporting-service': 'Reporting',
  'vision-ai': 'Vision AI',
  'analytics-ai': 'Analytics AI',
};

export function categoryMeta(category: string): {
  label: string;
  icon: LucideIcon;
  tint: string;
} {
  const key = category.toUpperCase();
  if (key.includes('SMS')) {
    return {
      label: 'SMS',
      icon: MessageSquare,
      tint: 'bg-[#eff6fc] text-[#0078d4]',
    };
  }
  if (key.includes('WHATSAPP')) {
    return {
      label: 'WhatsApp',
      icon: MessageCircle,
      tint: 'bg-[#dff6dd] text-[#107c10]',
    };
  }
  if (key.includes('EMAIL') || key.includes('MAIL')) {
    return {
      label: 'Email',
      icon: Mail,
      tint: 'bg-sky-50 text-sky-700',
    };
  }
  if (key.includes('PAYMENT') || key.includes('BANK') || key.includes('MOBILE')) {
    return {
      label: 'Payment',
      icon: CreditCard,
      tint: 'bg-amber-50 text-amber-700',
    };
  }
  if (key.includes('ANPR') || key.includes('VISION') || key.includes('CAMERA')) {
    return {
      label: 'ANPR',
      icon: Camera,
      tint: 'bg-indigo-50 text-indigo-700',
    };
  }
  return {
    label: category || 'Other',
    icon: Plug,
    tint: 'bg-slate-100 text-slate-600',
  };
}

export function deviceIcon(type: DeviceType): LucideIcon {
  switch (type) {
    case 'FINGERPRINT_SCANNER':
    case 'BIOMETRIC_TERMINAL':
      return Fingerprint;
    case 'FACE_TERMINAL':
      return ScanFace;
    case 'QR_SCANNER':
    case 'BARCODE_SCANNER':
      return QrCode;
    case 'RFID_READER':
    case 'SMART_CARD_READER':
      return Radio;
    case 'CCTV_CAMERA':
      return Video;
    case 'PRINTER':
      return HardDrive;
    default:
      return Smartphone;
  }
}

export function PanelEmpty({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#e1dfdd] bg-[#faf9f8] px-4 py-8 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eff6fc] text-[#0078d4]">
        {icon}
      </span>
      <p className="text-sm font-medium text-[#323130]">{title}</p>
      <p className="max-w-sm text-xs text-[#605e5c]">{description}</p>
    </div>
  );
}

export function ServiceCard({ row }: { row: PlatformServiceHealth }) {
  const online = isOnline(row.status);
  return (
    <GlassCard glow={online ? 'emerald' : 'rose'} className="!p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              online ? 'bg-[#107c10]' : 'bg-rose-500'
            }`}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1b1a19]">
              {SERVICE_LABELS[row.code] ?? row.name}
            </p>
            <p className="font-mono text-[11px] text-[#605e5c]">{row.code}</p>
          </div>
        </div>
        <StatusBadge status={serviceBadge(row.status)} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#605e5c]">
        <span className="truncate font-mono">
          {row.path}
        </span>
        <span className="shrink-0">
          {row.latencyMs != null ? `${row.latencyMs} ms` : '—'}
        </span>
      </div>
    </GlassCard>
  );
}

export function AdapterCard({
  row,
  onPing,
  pingBusy,
}: {
  row: ProviderAdapterHealth;
  onPing?: (code: string) => void;
  pingBusy?: boolean;
}) {
  const meta = categoryMeta(row.category);
  const Icon = meta.icon;
  return (
    <div className="rounded-lg border border-[#e1dfdd] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${meta.tint}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium text-[#1b1a19]">
              {row.code}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-[#605e5c]">
              {meta.label}
            </p>
          </div>
        </div>
        <StatusBadge status={adapterBadge(row.status)} />
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-[#605e5c]">
        {row.detail ?? row.adapterClass ?? '—'}
      </p>
      {onPing ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={pingBusy || row.status === 'DISABLED'}
            onClick={() => onPing(row.code)}
            className="inline-flex items-center gap-1 rounded-md border border-[#8a8886] bg-white px-2.5 py-1 text-[11px] font-medium text-[#323130] transition hover:bg-[#f3f2f1] disabled:opacity-60"
          >
            {pingBusy ? '…' : 'Ping'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
