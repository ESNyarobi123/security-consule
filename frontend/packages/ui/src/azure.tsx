'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Azure-portal-inspired design system for the HIGHLINK console.
 * Dependency-free inline glyphs + colored service tiles + collapsible
 * category sections. Colors follow a Fluent/Azure palette.
 */

// ── Azure palette tokens (Fluent) ──
export const AZURE = {
  blue: '#0078d4',
  blueDark: '#005a9e',
  blueDarker: '#004578',
  navy: '#12263f',
  headerFrom: '#0b1f3a',
  headerVia: '#0e2f52',
  headerTo: '#123a63',
  neutralBg: '#f5f6fa',
  cardBorder: '#e1dfdd',
  text: '#323130',
  textSub: '#605e5c',
} as const;

export type GlyphName =
  | 'grid'
  | 'building'
  | 'contract'
  | 'shield-user'
  | 'users'
  | 'wallet'
  | 'coins'
  | 'cart'
  | 'shield'
  | 'video'
  | 'branch'
  | 'badge-check'
  | 'check-circle'
  | 'headset'
  | 'megaphone'
  | 'code'
  | 'user-check'
  | 'car'
  | 'clipboard'
  | 'key'
  | 'box'
  | 'alert'
  | 'calendar'
  | 'book'
  | 'file-chart'
  | 'home'
  | 'star'
  | 'plus'
  | 'search'
  | 'bell'
  | 'gear'
  | 'help'
  | 'chevron-down'
  | 'chevron-left'
  | 'menu'
  | 'sparkles'
  | 'terminal'
  | 'logout'
  | 'layers'
  | 'default';

/** Inline stroke glyph (24×24, currentColor). Keeps @pssms/ui dependency-free. */
export function AzureGlyph({
  name,
  className,
}: {
  name: GlyphName;
  className?: string;
}) {
  const common = {
    className: className ?? 'h-[18px] w-[18px]',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'building':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
          <path d="M10 21v-3h4v3" />
        </svg>
      );
    case 'contract':
      return (
        <svg {...common}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
          <path d="M14 2v5h5" />
          <path d="M9 13l1.5 1.5L13 12" />
          <path d="M9 17h6" />
        </svg>
      );
    case 'shield-user':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <circle cx="12" cy="10" r="2.2" />
          <path d="M8.5 16a3.5 3.5 0 0 1 7 0" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
          <circle cx="16.5" cy="13" r="1" />
        </svg>
      );
    case 'coins':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" />
        </svg>
      );
    case 'cart':
      return (
        <svg {...common}>
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
      );
    case 'video':
      return (
        <svg {...common}>
          <path d="m16 13 5.2 3.5a1 1 0 0 0 1.5-.9V7.4a1 1 0 0 0-1.5-.9L16 10" />
          <rect x="2" y="6" width="14" height="12" rx="2" />
        </svg>
      );
    case 'branch':
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
        </svg>
      );
    case 'badge-check':
      return (
        <svg {...common}>
          <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...common}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="m9 11 3 3L22 4" />
        </svg>
      );
    case 'headset':
      return (
        <svg {...common}>
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
          <path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z" />
          <path d="M3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2Z" />
          <path d="M18 17a4 4 0 0 1-4 4h-2" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg {...common}>
          <path d="m3 11 18-5v12L3 14v-3Z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
    case 'code':
      return (
        <svg {...common}>
          <path d="m8 6-6 6 6 6" />
          <path d="m16 6 6 6-6 6" />
        </svg>
      );
    case 'user-check':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="m16 11 2 2 4-4" />
        </svg>
      );
    case 'car':
      return (
        <svg {...common}>
          <path d="M5 17H3v-5l2-5h14l2 5v5h-2" />
          <path d="M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg {...common}>
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case 'key':
      return (
        <svg {...common}>
          <circle cx="7.5" cy="15.5" r="4.5" />
          <path d="m10.7 12.3 8.3-8.3M16 5l3 3M14 7l3 3" />
        </svg>
      );
    case 'box':
      return (
        <svg {...common}>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="m10.3 3.3-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.7-2.7l-8-14a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M8 14h.01M12 14h.01M16 14h.01" />
        </svg>
      );
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
      );
    case 'file-chart':
      return (
        <svg {...common}>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
          <path d="M14 2v5h5" />
          <path d="M8 18v-3M12 18v-6M16 18v-2" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2Z" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8Z" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      );
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case 'chevron-left':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" />
          <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z" />
        </svg>
      );
    case 'terminal':
      return (
        <svg {...common}>
          <path d="m4 17 6-6-6-6M12 19h8" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5M21 12H9" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 2 9 5-9 5-9-5Z" />
          <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

/** Colored rounded-square icon tile (Azure service-icon style). */
export function ServiceIcon({
  glyph,
  color,
  size = 'md',
}: {
  glyph: GlyphName;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const glyphSize =
    size === 'sm'
      ? 'h-[17px] w-[17px]'
      : size === 'lg'
        ? 'h-6 w-6'
        : 'h-[21px] w-[21px]';
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-[10px] text-white shadow-sm`}
      style={{
        background: `linear-gradient(140deg, ${color}, ${shade(color, -14)})`,
        boxShadow: `0 4px 10px -4px ${color}80`,
      }}
    >
      <AzureGlyph name={glyph} className={glyphSize} />
    </span>
  );
}

/** Small top-row quick access tile (icon + label). */
export function QuickTile({
  title,
  glyph,
  color,
  href,
}: {
  title: string;
  glyph: GlyphName;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-xl border border-transparent px-2 py-3 text-center transition hover:border-[#e1dfdd] hover:bg-white hover:shadow-sm"
    >
      <ServiceIcon glyph={glyph} color={color} />
      <span className="line-clamp-2 text-[11.5px] font-medium leading-tight text-[#0067b8] group-hover:underline">
        {title}
      </span>
    </Link>
  );
}

/** Catalog row tile — icon + title + description (Azure "all services" look). */
export function ServiceTile({
  title,
  description,
  glyph,
  color,
  href,
  badge,
  external,
}: {
  title: string;
  description?: string;
  glyph: GlyphName;
  color: string;
  href: string;
  badge?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <ServiceIcon glyph={glyph} color={color} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-[#0067b8] group-hover:underline">
            {title}
          </span>
          {badge ? (
            <span className="rounded-[3px] bg-[#fff4ce] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#8a6d00]">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 line-clamp-1 text-[12px] text-[#605e5c]">
            {description}
          </p>
        ) : null}
      </div>
    </>
  );

  const className =
    'group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition hover:border-[#e1dfdd] hover:bg-[#f3f9fd]';

  if (external) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/** Collapsible category section with count + divider (Azure home style). */
export function CategorySection({
  title,
  count,
  children,
  open,
  onToggle,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="border-t border-[#edebe9] pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4]"
      >
        <h2 className="text-[15px] font-semibold text-[#323130]">
          {title}
          {typeof count === 'number' ? (
            <span className="ml-1.5 font-normal text-[#605e5c]">({count})</span>
          ) : null}
        </h2>
        <span className="flex-1" />
        <span
          aria-hidden
          className={`text-[#605e5c] transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        >
          <AzureGlyph name="chevron-down" className="h-4 w-4" />
        </span>
      </button>
      <div
        className={`grid overflow-hidden transition-all duration-200 ${open ? 'mt-3 grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0">
          <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Route → icon glyph + brand color, shared by the sidebar and dashboard. */
export function moduleVisual(href: string): { glyph: GlyphName; color: string } {
  const map: Array<[string, { glyph: GlyphName; color: string }]> = [
    ['/superadmin/customers', { glyph: 'building', color: '#0ea5e9' }],
    ['/superadmin/contracts', { glyph: 'contract', color: '#6366f1' }],
    ['/superadmin', { glyph: 'grid', color: '#0078d4' }],
    ['/operations/guards', { glyph: 'shield-user', color: '#059669' }],
    ['/operations', { glyph: 'shield', color: '#2563eb' }],
    ['/hr', { glyph: 'users', color: '#f59e0b' }],
    ['/payroll', { glyph: 'wallet', color: '#8b5cf6' }],
    ['/finance', { glyph: 'coins', color: '#16a34a' }],
    ['/procurement', { glyph: 'cart', color: '#f97316' }],
    ['/cctv', { glyph: 'video', color: '#64748b' }],
    ['/branch', { glyph: 'branch', color: '#0d9488' }],
    ['/compliance', { glyph: 'badge-check', color: '#0284c7' }],
    ['/approvals', { glyph: 'check-circle', color: '#7c3aed' }],
    ['/callcentre', { glyph: 'headset', color: '#e11d48' }],
    ['/marketing', { glyph: 'megaphone', color: '#db2777' }],
    ['/developer', { glyph: 'code', color: '#475569' }],
  ];
  const hit = map.find(([prefix]) => href === prefix || href.startsWith(`${prefix}/`));
  return hit ? hit[1] : { glyph: 'default', color: '#0078d4' };
}

/** Lighten/darken a hex color by percent (-100..100). */
export function shade(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const num = parseInt(full, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
