import type { ReactNode } from 'react';
import {
  Bike,
  Bus,
  Car,
  Truck,
  type LucideIcon,
} from 'lucide-react';

export const PARK = {
  navy: '#0f2744',
  teal: '#0d9488',
  blue: '#2563eb',
  amber: '#f59e0b',
  rose: '#e11d48',
  ink: '#0f172a',
  muted: '#64748b',
  soft: '#f1f5f9',
  card: '#ffffff',
  line: '#e2e8f0',
} as const;

export type VehicleKind = 'CAR' | 'MOTORCYCLE' | 'TRUCK' | 'BUS' | 'OTHER';

export const VEHICLE_META: Record<
  VehicleKind,
  { label: string; icon: LucideIcon; accent: string; soft: string }
> = {
  CAR: {
    label: 'Car',
    icon: Car,
    accent: '#2563eb',
    soft: '#dbeafe',
  },
  MOTORCYCLE: {
    label: 'Bike',
    icon: Bike,
    accent: '#0d9488',
    soft: '#ccfbf1',
  },
  TRUCK: {
    label: 'Truck',
    icon: Truck,
    accent: '#d97706',
    soft: '#fef3c7',
  },
  BUS: {
    label: 'Bus',
    icon: Bus,
    accent: '#7c3aed',
    soft: '#ede9fe',
  },
  OTHER: {
    label: 'Other',
    icon: Car,
    accent: '#64748b',
    soft: '#f1f5f9',
  },
};

export function normalizeVehicleType(raw?: string | null): VehicleKind {
  const t = (raw ?? 'OTHER').toUpperCase();
  if (t === 'CAR' || t === 'MOTORCYCLE' || t === 'TRUCK' || t === 'BUS') {
    return t;
  }
  if (t === 'MOTORBIKE' || t === 'BIKE' || t === 'MOTO') return 'MOTORCYCLE';
  return 'OTHER';
}

/** Module 13-I — who the vehicle is for (not body type) */
export type ParkingCategoryKind =
  | 'CUSTOMER'
  | 'CUSTOMER_EMPLOYEE'
  | 'VISITOR'
  | 'COMPANY'
  | 'PATROL'
  | 'SUPPLIER'
  | 'CONTRACTOR'
  | 'EMERGENCY'
  | 'TEMPORARY';

export const PARKING_CATEGORY_META: Record<
  ParkingCategoryKind,
  { label: string; needsCustomer: boolean; fleetOnly: boolean }
> = {
  CUSTOMER: { label: 'Customer', needsCustomer: true, fleetOnly: false },
  CUSTOMER_EMPLOYEE: {
    label: 'Customer employee',
    needsCustomer: true,
    fleetOnly: false,
  },
  VISITOR: { label: 'Visitor', needsCustomer: false, fleetOnly: false },
  COMPANY: { label: 'Company', needsCustomer: false, fleetOnly: true },
  PATROL: { label: 'Patrol', needsCustomer: false, fleetOnly: true },
  SUPPLIER: { label: 'Supplier', needsCustomer: false, fleetOnly: false },
  CONTRACTOR: { label: 'Contractor', needsCustomer: false, fleetOnly: false },
  EMERGENCY: { label: 'Emergency', needsCustomer: false, fleetOnly: true },
  TEMPORARY: { label: 'Temporary', needsCustomer: false, fleetOnly: false },
};

export const PARKING_CATEGORIES = Object.keys(
  PARKING_CATEGORY_META,
) as ParkingCategoryKind[];

export function normalizeParkingCategory(
  raw?: string | null,
): ParkingCategoryKind {
  const t = (raw ?? 'CUSTOMER').toUpperCase();
  if ((PARKING_CATEGORIES as string[]).includes(t)) {
    return t as ParkingCategoryKind;
  }
  return 'CUSTOMER';
}

export function KpiCard({
  label,
  value,
  href,
  tone = 'blue',
  hint,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: 'blue' | 'teal' | 'amber' | 'rose' | 'slate';
  hint?: string;
}) {
  const ring =
    tone === 'teal'
      ? 'hover:border-teal-400'
      : tone === 'amber'
        ? 'hover:border-amber-400'
        : tone === 'rose'
          ? 'hover:border-rose-400'
          : tone === 'slate'
            ? 'hover:border-slate-400'
            : 'hover:border-blue-400';
  const valueColor =
    tone === 'teal'
      ? 'text-teal-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'rose'
          ? 'text-rose-700'
          : tone === 'slate'
            ? 'text-slate-800'
            : 'text-blue-700';

  const inner = (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition ${ring} hover:shadow-md`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className={`mt-2 font-display text-3xl font-bold tracking-tight ${valueColor}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        {inner}
      </a>
    );
  }
  return inner;
}

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-slate-900 sm:text-lg">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function VehicleTypeCard({
  kind,
  count,
  active,
  onClick,
}: {
  kind: VehicleKind;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const meta = VEHICLE_META[kind];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition ${
        active
          ? 'shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
      style={
        active
          ? {
              background: meta.soft,
              borderColor: meta.accent,
              boxShadow: `0 0 0 2px ${meta.accent}33`,
            }
          : undefined
      }
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: active ? '#fff' : meta.soft, color: meta.accent }}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <span className="text-sm font-bold text-slate-900">{meta.label}</span>
      <span className="text-xs font-semibold text-slate-500">{count} registered</span>
    </button>
  );
}

type GlyphProps = { className?: string; color?: string };

/** Top-down colored glyphs — color follows vehicle type */
export function CarTopIcon({
  className = 'h-8 w-8',
  color = VEHICLE_META.CAR.accent,
}: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="14" y="8" width="20" height="32" rx="6" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
      <rect x="17" y="12" width="14" height="8" rx="2" fill={color} fillOpacity="0.45" />
      <rect x="17" y="28" width="14" height="7" rx="2" fill={color} fillOpacity="0.45" />
      <rect x="15" y="36" width="5" height="3" rx="1" fill="#ef4444" />
      <rect x="28" y="36" width="5" height="3" rx="1" fill="#ef4444" />
      <circle cx="18" cy="22" r="1.5" fill={color} />
      <circle cx="30" cy="22" r="1.5" fill={color} />
    </svg>
  );
}

export function BikeTopIcon({
  className = 'h-8 w-8',
  color = VEHICLE_META.MOTORCYCLE.accent,
}: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="16" cy="30" r="7" stroke={color} strokeWidth="2.25" fill={color} fillOpacity="0.12" />
      <circle cx="32" cy="30" r="7" stroke={color} strokeWidth="2.25" fill={color} fillOpacity="0.12" />
      <path
        d="M16 30h10l6-12H22l-6 12Z"
        stroke={color}
        strokeWidth="2"
        fill={color}
        fillOpacity="0.35"
      />
      <circle cx="16" cy="30" r="2" fill={color} />
      <circle cx="32" cy="30" r="2" fill={color} />
    </svg>
  );
}

export function TruckTopIcon({
  className = 'h-8 w-8',
  color = VEHICLE_META.TRUCK.accent,
}: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="8" y="14" width="22" height="18" rx="3" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="2" />
      <rect x="30" y="20" width="10" height="12" rx="2" fill={color} fillOpacity="0.4" stroke={color} strokeWidth="2" />
      <circle cx="16" cy="34" r="3.2" fill={color} />
      <circle cx="34" cy="34" r="3.2" fill={color} />
      <rect x="32" y="22" width="6" height="5" rx="1" fill="#fff" fillOpacity="0.7" />
    </svg>
  );
}

export function BusTopIcon({
  className = 'h-8 w-8',
  color = VEHICLE_META.BUS.accent,
}: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="12" y="6" width="24" height="34" rx="5" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="2" />
      <rect x="15" y="10" width="18" height="6" rx="1.5" fill={color} fillOpacity="0.5" />
      <rect x="15" y="19" width="7" height="5" rx="1" fill={color} fillOpacity="0.45" />
      <rect x="26" y="19" width="7" height="5" rx="1" fill={color} fillOpacity="0.45" />
      <rect x="15" y="27" width="7" height="5" rx="1" fill={color} fillOpacity="0.45" />
      <rect x="26" y="27" width="7" height="5" rx="1" fill={color} fillOpacity="0.45" />
      <circle cx="18" cy="38" r="2.5" fill={color} />
      <circle cx="30" cy="38" r="2.5" fill={color} />
    </svg>
  );
}

export function VehicleGlyph({
  kind,
  className = 'h-8 w-8',
}: {
  kind: VehicleKind;
  className?: string;
}) {
  const color = VEHICLE_META[kind].accent;
  if (kind === 'MOTORCYCLE') return <BikeTopIcon className={className} color={color} />;
  if (kind === 'TRUCK') return <TruckTopIcon className={className} color={color} />;
  if (kind === 'BUS') return <BusTopIcon className={className} color={color} />;
  if (kind === 'OTHER') {
    return <CarTopIcon className={className} color={VEHICLE_META.OTHER.accent} />;
  }
  return <CarTopIcon className={className} color={color} />;
}

/** @deprecated use VehicleGlyph */
export function vehicleGlyph(kind: VehicleKind) {
  if (kind === 'MOTORCYCLE') return BikeTopIcon;
  if (kind === 'TRUCK') return TruckTopIcon;
  if (kind === 'BUS') return BusTopIcon;
  return CarTopIcon;
}
