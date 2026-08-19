'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpen,
  CalendarClock,
  Car,
  ChevronRight,
  ClipboardCheck,
  DoorOpen,
  FileBarChart,
  MapPin,
  Radio,
  Route,
  Shield,
  ShieldAlert,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Branch Ops control room — navy / sky / emerald / amber / rose (no purple). */
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

/** Visual chips in the hero band (link where useful). */
export const HERO_CHIPS: { label: string; href?: string }[] = [
  { label: 'Sites', href: '/branch/sites' },
  { label: 'Access points', href: '/branch/access-points' },
  { label: 'Deployments', href: '/branch/deployments' },
  { label: 'Shifts', href: '/branch/shifts' },
  { label: 'Attendance', href: '/branch/attendance' },
  { label: 'Field alerts', href: '/branch/alerts' },
  { label: 'EOB', href: '/branch/eob' },
  { label: 'Patrols', href: '/branch/patrols' },
  { label: 'Incidents', href: '/branch/incidents' },
  { label: 'Staff', href: '/branch/staff' },
  { label: 'Inspections', href: '/branch/inspections' },
  { label: 'Parking', href: '/branch/parking' },
  { label: 'Petty cash', href: '/branch/petty-cash' },
  { label: 'Reports', href: '/branch/reports' },
];

export type QuickLink = {
  href: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tone: KpiTone;
};

export const QUICK_LINKS: QuickLink[] = [
  {
    href: '/branch/sites',
    label: 'Sites',
    hint: 'Facilities under each branch',
    Icon: MapPin,
    tone: 'sky',
  },
  {
    href: '/branch/access-points',
    label: 'Access points',
    hint: 'Site gates · pedestrian / vehicle',
    Icon: DoorOpen,
    tone: 'teal',
  },
  {
    href: '/branch/deployments',
    label: 'Deployments',
    hint: 'Assign / end guard postings',
    Icon: Shield,
    tone: 'emerald',
  },
  {
    href: '/branch/shifts',
    label: 'Shifts',
    hint: 'Site schedules & windows',
    Icon: Timer,
    tone: 'teal',
  },
  {
    href: '/branch/attendance',
    label: 'Attendance',
    hint: 'Today’s clock + alertness',
    Icon: CalendarClock,
    tone: 'sky',
  },
  {
    href: '/branch/alerts',
    label: 'Field alerts',
    hint: 'Ack open BOM / field flags',
    Icon: Bell,
    tone: 'rose',
  },
  {
    href: '/branch/eob',
    label: 'EOB',
    hint: 'Occurrence book + attachments',
    Icon: BookOpen,
    tone: 'amber',
  },
  {
    href: '/branch/patrols',
    label: 'Patrols',
    hint: 'Checkpoints & scan log',
    Icon: Route,
    tone: 'teal',
  },
  {
    href: '/branch/incidents',
    label: 'Incidents',
    hint: 'Create, list, escalate status',
    Icon: ShieldAlert,
    tone: 'rose',
  },
  {
    href: '/branch/staff',
    label: 'Staff',
    hint: 'Guards on post (not HR hire)',
    Icon: Users,
    tone: 'emerald',
  },
  {
    href: '/branch/inspections',
    label: 'Inspections',
    hint: 'Supervisor comments / handover',
    Icon: ClipboardCheck,
    tone: 'amber',
  },
  {
    href: '/branch/parking',
    label: 'Parking',
    hint: 'Site entry/violations monitor',
    Icon: Car,
    tone: 'teal',
  },
  {
    href: '/branch/petty-cash',
    label: 'Petty cash',
    hint: 'Request only — Finance issues',
    Icon: Wallet,
    tone: 'sky',
  },
  {
    href: '/branch/reports',
    label: 'Reports',
    hint: 'Period pack · attendance through gate',
    Icon: FileBarChart,
    tone: 'sky',
  },
  {
    href: '/operations',
    label: 'Ops Console',
    hint: 'Guard readiness control room',
    Icon: Radio,
    tone: 'slate',
  },
  {
    href: '/operations/guards',
    label: 'Guards',
    hint: 'Roster · suspend · deployable',
    Icon: Users,
    tone: 'emerald',
  },
];

export function KpiCard({
  label,
  value,
  hint,
  tone,
  icon,
  pulse,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: KpiTone;
  icon: ReactNode;
  pulse?: boolean;
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
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${t.icon}`}
        >
          {pulse ? (
            <span
              className="absolute inset-0 animate-ping rounded-lg bg-rose-400/40"
              aria-hidden
            />
          ) : null}
          <span className="relative">{icon}</span>
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

/** Light-surface link cards (sit on white admin chrome — dark text for contrast). */
const QUICK_LINK_TONES: Record<
  KpiTone,
  { surface: string; bar: string; icon: string }
> = {
  sky: {
    surface: 'bg-sky-50 ring-sky-200/80 hover:bg-sky-100/90',
    bar: 'bg-sky-500',
    icon: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
  },
  emerald: {
    surface: 'bg-emerald-50 ring-emerald-200/80 hover:bg-emerald-100/90',
    bar: 'bg-emerald-500',
    icon: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  },
  teal: {
    surface: 'bg-teal-50 ring-teal-200/80 hover:bg-teal-100/90',
    bar: 'bg-teal-500',
    icon: 'bg-teal-100 text-teal-700 ring-1 ring-teal-200',
  },
  rose: {
    surface: 'bg-rose-50 ring-rose-200/80 hover:bg-rose-100/90',
    bar: 'bg-rose-500',
    icon: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
  },
  amber: {
    surface: 'bg-amber-50 ring-amber-200/80 hover:bg-amber-100/90',
    bar: 'bg-amber-500',
    icon: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  },
  slate: {
    surface: 'bg-slate-50 ring-slate-200/80 hover:bg-slate-100/90',
    bar: 'bg-slate-500',
    icon: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  },
};

export function QuickLinkCard({
  href,
  label,
  hint,
  Icon,
  tone,
}: QuickLink) {
  const t = QUICK_LINK_TONES[tone];
  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-xl ${t.surface} px-4 py-3.5 ring-1 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
    >
      <span
        className={`absolute left-0 top-0 h-full w-1 ${t.bar} transition group-hover:w-1.5`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2 pl-1">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.icon} transition group-hover:scale-105`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
      </div>
      <p className="mt-2.5 pl-1 text-sm font-semibold text-[#1b1a19]">
        {label}
      </p>
      <p className="mt-0.5 pl-1 text-[11px] leading-snug text-[#605e5c]">
        {hint}
      </p>
    </Link>
  );
}
