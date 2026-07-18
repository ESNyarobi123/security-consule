import type { ReactNode } from 'react';

/** Section subheading for dashboard pages (Azure/Fluent). */
export function SectionTitle({
  children,
  action,
  className = '',
}: {
  children: ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={`mb-3 flex items-center justify-between gap-3 ${className}`}
    >
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#605e5c]">
        {children}
      </h2>
      {action ? (
        <a
          href={action.href}
          className="text-xs font-medium text-[#0067b8] transition hover:text-[#004578]"
        >
          {action.label} →
        </a>
      ) : null}
    </div>
  );
}

export type StatAccent = 'blue' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

const STAT_ICON: Record<StatAccent, string> = {
  blue: 'bg-[#eff6fc] text-[#0078d4]',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-[#dff6dd] text-[#107c10]',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-indigo-50 text-indigo-600',
  slate: 'bg-slate-100 text-slate-600',
};

/** Compact KPI tile for dense dashboards (icon chip + value + hint). */
export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = 'blue',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  accent?: StatAccent;
}) {
  return (
    <div className="rounded-xl border border-[#e1dfdd] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-3">
        {icon ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${STAT_ICON[accent]}`}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-[#605e5c]">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-[#1b1a19]">
            {typeof value === 'number' ? value.toLocaleString('en-TZ') : value}
          </p>
        </div>
      </div>
      {hint ? <p className="mt-2 text-[11px] text-[#605e5c]">{hint}</p> : null}
    </div>
  );
}

/** Clean white surface for admin analytics console. */
export function GlassCard({
  children,
  className = '',
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: 'emerald' | 'sky' | 'rose' | 'amber' | 'none';
}) {
  const topAccent =
    glow === 'emerald'
      ? 'before:from-[#107c10]/70'
      : glow === 'sky'
        ? 'before:from-sky-400/70'
        : glow === 'rose'
          ? 'before:from-rose-400/70'
          : glow === 'amber'
            ? 'before:from-amber-400/70'
            : glow === 'none'
              ? 'before:from-[#0078d4]/60'
              : 'before:from-[#0078d4]/70';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:to-transparent ${topAccent} ${className}`}
    >
      {children}
    </div>
  );
}

export function ConsoleSectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {action ? (
        <a
          href={action.href}
          className="text-xs font-medium text-[#0067b8] transition hover:text-[#004578]"
        >
          {action.label} →
        </a>
      ) : null}
    </div>
  );
}

export type MetricTrend = {
  value: number;
  direction: 'up' | 'down' | 'flat';
};

const METRIC_ACCENT: Record<
  string,
  { from: string; to: string; glow: string; tint: string }
> = {
  sky: { from: '#38bdf8', to: '#0284c7', glow: '#0ea5e9', tint: '#f0f9ff' },
  emerald: { from: '#34d399', to: '#059669', glow: '#10b981', tint: '#ecfdf5' },
  rose: { from: '#fb7185', to: '#e11d48', glow: '#f43f5e', tint: '#fff1f2' },
  amber: { from: '#fbbf24', to: '#d97706', glow: '#f59e0b', tint: '#fffbeb' },
  violet: { from: '#818cf8', to: '#4f46e5', glow: '#6366f1', tint: '#eef2ff' },
};

/** Premium top-row KPI tile — gradient icon chip, watermark, hover glow. */
export function MetricStatCard({
  label,
  value,
  icon,
  trend,
  accent = 'sky',
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: MetricTrend;
  accent?: 'sky' | 'emerald' | 'rose' | 'amber' | 'violet';
}) {
  const a = METRIC_ACCENT[accent] ?? METRIC_ACCENT.sky;

  const trendPositive =
    trend &&
    ((trend.direction === 'up' &&
      !label.toLowerCase().includes('incident') &&
      !label.toLowerCase().includes('miss') &&
      !label.toLowerCase().includes('dormant')) ||
      (trend.direction === 'down' &&
        (label.toLowerCase().includes('incident') ||
          label.toLowerCase().includes('miss') ||
          label.toLowerCase().includes('dormant'))));

  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-[#e7e9ee] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-18px_rgba(16,24,40,0.18)] transition-all duration-300 hover:-translate-y-1.5 hover:border-transparent hover:shadow-[0_22px_44px_-20px_rgba(16,24,40,0.35)]">
      {/* top gradient bar */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${a.from}, ${a.to})` }}
      />
      {/* hover glow blob */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: a.glow }}
      />
      {/* faint icon watermark */}
      {icon ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-5 -right-3 rotate-[-8deg] opacity-[0.06] transition-transform duration-300 group-hover:scale-110 [&_svg]:h-28 [&_svg]:w-28"
          style={{ color: a.to }}
        >
          {icon}
        </span>
      ) : null}

      <div className="relative flex items-start justify-between">
        {icon ? (
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-hover:scale-105 [&_svg]:h-6 [&_svg]:w-6"
            style={{
              background: `linear-gradient(140deg, ${a.from}, ${a.to})`,
              boxShadow: `0 10px 22px -8px ${a.glow}`,
            }}
          >
            {icon}
          </span>
        ) : (
          <span />
        )}
        <span
          aria-hidden
          className="translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
          style={{ color: a.to }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
        </span>
      </div>

      <p className="relative mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#605e5c]">
        {label}
      </p>
      <div className="relative mt-1 flex items-end justify-between gap-2">
        <p className="text-[2rem] font-bold leading-none tracking-tight text-[#1b1a19] [font-variant-numeric:tabular-nums]">
          {typeof value === 'number' ? value.toLocaleString('en-TZ') : value}
        </p>
        {trend ? (
          <span
            className={`mb-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              trend.direction === 'flat'
                ? 'bg-slate-100 text-slate-600'
                : trendPositive
                  ? 'bg-[#dff6dd] text-[#0e700e]'
                  : 'bg-rose-50 text-rose-700'
            }`}
          >
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : ''}
            {Math.abs(trend.value)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Semi-circular health gauge. */
export function RiskGauge({
  value,
  label = 'Risk level',
  caption,
}: {
  value: number;
  label?: string;
  caption?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 70;
  const cx = 100;
  const cy = 90;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle + (endAngle - startAngle) * (clamped / 100);

  const polar = (a: number, radius: number) => ({
    x: cx + radius * Math.cos(a),
    y: cy - radius * Math.sin(a),
  });

  const arcPath = (from: number, to: number, radius: number) => {
    const s = polar(from, radius);
    const e = polar(to, radius);
    const large = to - from > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needle = polar(angle, r - 8);
  const color =
    clamped >= 70 ? '#0d9488' : clamped >= 40 ? '#d97706' : '#e11d48';

  return (
    <GlassCard glow="emerald" className="flex flex-col items-center">
      <ConsoleSectionHeader title={label} />
      <svg viewBox="0 0 200 120" className="w-full max-w-[280px]">
        <path
          d={arcPath(Math.PI, 0, r)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d={arcPath(Math.PI, angle, r)}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill={color} />
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          fill="#0f172a"
          style={{ fontSize: 28, fontWeight: 600 }}
        >
          {clamped}%
        </text>
      </svg>
      {caption ? (
        <p className="mt-1 text-center text-xs text-slate-500">{caption}</p>
      ) : null}
    </GlassCard>
  );
}

export type SeverityItem = {
  label: string;
  value: number;
  max?: number;
  color: string;
};

export function SeverityRings({
  title,
  items,
  action,
}: {
  title: string;
  items: SeverityItem[];
  action?: { label: string; href: string };
}) {
  return (
    <GlassCard className="h-full">
      <ConsoleSectionHeader title={title} action={action} />
      <div className="flex flex-wrap items-center justify-around gap-4 py-2">
        {items.map((item) => {
          const max = item.max ?? 100;
          const pct = Math.min(100, (item.value / max) * 100);
          const r = 28;
          const c = 2 * Math.PI * r;
          const offset = c - (pct / 100) * c;
          return (
            <div key={item.label} className="flex flex-col items-center gap-2">
              <div className="relative h-[72px] w-[72px]">
                <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
                  <circle
                    cx="36"
                    cy="36"
                    r={r}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="6"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r={r}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-900">
                  {item.value}
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export type RegionStat = {
  name: string;
  code: string;
  percent: number;
  flagEmoji?: string;
};

export function RegionFootprint({
  title,
  regions,
  totalLabel,
}: {
  title: string;
  regions: RegionStat[];
  totalLabel?: string;
}) {
  return (
    <GlassCard className="h-full" glow="sky">
      <ConsoleSectionHeader title={title} />
      {totalLabel ? (
        <p className="mb-4 text-xs text-slate-500">{totalLabel}</p>
      ) : null}
      <div className="space-y-4">
        {regions.map((r) => (
          <div key={r.code}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="text-base leading-none">
                  {r.flagEmoji ?? '📍'}
                </span>
                {r.name}
              </span>
              <span className="font-medium text-slate-900">{r.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-600 to-sky-500"
                style={{ width: `${r.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-6 h-28 overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 via-sky-50/80 to-teal-50">
        <div className="absolute inset-0 opacity-70">
          {[
            { t: '18%', l: '22%' },
            { t: '35%', l: '48%' },
            { t: '55%', l: '62%' },
            { t: '28%', l: '70%' },
            { t: '62%', l: '35%' },
          ].map((dot, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 animate-pulse rounded-full bg-teal-500 shadow-sm shadow-teal-400/50"
              style={{ top: dot.t, left: dot.l, animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
        <p className="absolute bottom-2 left-3 text-[10px] uppercase tracking-wider text-slate-500">
          Live deployment map
        </p>
      </div>
    </GlassCard>
  );
}

export type StackedBarPoint = {
  label: string;
  segments: { key: string; value: number; color: string }[];
};

export function StackedBarPanel({
  title,
  legend,
  data,
}: {
  title: string;
  legend: { key: string; label: string; color: string }[];
  data: StackedBarPoint[];
}) {
  const max = Math.max(
    1,
    ...data.map((d) => d.segments.reduce((s, seg) => s + seg.value, 0)),
  );

  return (
    <GlassCard className="h-full">
      <ConsoleSectionHeader title={title} />
      <div className="mb-4 flex flex-wrap gap-3">
        {legend.map((l) => (
          <span
            key={l.key}
            className="flex items-center gap-1.5 text-[11px] text-slate-500"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: l.color }}
            />
            {l.label}
          </span>
        ))}
      </div>
      <div className="flex h-44 items-end justify-between gap-2 px-1">
        {data.map((d) => {
          const total = d.segments.reduce((s, seg) => s + seg.value, 0);
          const heightPct = (total / max) * 100;
          return (
            <div
              key={d.label}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-36 w-full items-end justify-center rounded-xl bg-slate-50 p-1.5">
                <div
                  className="flex w-full max-w-[36px] flex-col-reverse overflow-hidden rounded-lg"
                  style={{ height: `${heightPct}%` }}
                >
                  {d.segments.map((seg) => (
                    <div
                      key={seg.key}
                      style={{
                        background: seg.color,
                        height: `${(seg.value / total) * 100}%`,
                      }}
                      title={`${seg.key}: ${seg.value}`}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-500">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export type TrendPoint = { label: string; value: number };

/** Real area/line chart for time-series (e.g. activity per day). */
export function TrendAreaChart({
  title,
  points,
  action,
  color = '#4f46e5',
  unit,
}: {
  title: string;
  points: TrendPoint[];
  action?: { label: string; href: string };
  color?: string;
  unit?: string;
}) {
  const w = 520;
  const h = 180;
  const pad = { top: 16, right: 12, bottom: 26, left: 28 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const xy = points.map((p, i) => {
    const x = pad.left + i * stepX;
    const y = pad.top + innerH - (p.value / max) * innerH;
    return { x, y, ...p };
  });

  const linePath = xy
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    xy.length > 0
      ? `${linePath} L ${xy[xy.length - 1].x.toFixed(1)} ${pad.top + innerH} L ${xy[0].x.toFixed(1)} ${pad.top + innerH} Z`
      : '';
  const total = points.reduce((s, p) => s + p.value, 0);

  return (
    <GlassCard glow="none" className="h-full">
      <ConsoleSectionHeader title={title} action={action} />
      <p className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">
        {total.toLocaleString('en-TZ')}
        {unit ? <span className="ml-1 text-sm text-slate-400">{unit}</span> : null}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((g) => {
          const y = pad.top + innerH - g * innerH;
          return (
            <line
              key={g}
              x1={pad.left}
              y1={y}
              x2={w - pad.right}
              y2={y}
              stroke="#eef2f7"
              strokeWidth="1"
            />
          );
        })}
        {areaPath ? <path d={areaPath} fill="url(#trendFill)" /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {xy.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
            <text
              x={p.x}
              y={h - 8}
              textAnchor="middle"
              fill="#94a3b8"
              style={{ fontSize: 10 }}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </GlassCard>
  );
}

export function StatusListCard({
  title,
  action,
  items,
}: {
  title: string;
  action?: { label: string; href: string };
  items: {
    label: string;
    status: 'ok' | 'warn' | 'bad';
    detail?: string;
    progress?: number;
  }[];
}) {
  const statusDot = {
    ok: 'bg-teal-500',
    warn: 'bg-amber-500',
    bad: 'bg-rose-500',
  };

  return (
    <GlassCard>
      <ConsoleSectionHeader title={title} action={action} />
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <span
                  className={`h-2 w-2 rounded-full ${statusDot[item.status]}`}
                />
                {item.label}
              </span>
              {item.detail ? (
                <span className="text-xs font-medium text-slate-500">
                  {item.detail}
                </span>
              ) : null}
            </div>
            {typeof item.progress === 'number' ? (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    item.status === 'bad'
                      ? 'bg-rose-500'
                      : item.status === 'warn'
                        ? 'bg-amber-500'
                        : 'bg-teal-600'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
