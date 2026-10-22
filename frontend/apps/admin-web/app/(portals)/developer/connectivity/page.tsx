'use client';

import {
  getDeveloperConnectivity,
  type ConnectivityGroup,
  type ConnectivityReport,
  type ConnectivityStatus,
  type ConnectivitySystem,
} from '@pssms/api-client';
import { GlassCard, StatCard, btnSecondary } from '@pssms/ui';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  CreditCard,
  Database,
  Fingerprint,
  Mail,
  MessageCircle,
  MessageSquare,
  Plug,
  RefreshCw,
  Server,
  Settings2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

const GROUP_ORDER: ConnectivityGroup[] = [
  'PLATFORM',
  'MESSAGING',
  'PAYMENTS',
  'DEVICES',
  'DATA',
];

const GROUP_LABEL: Record<ConnectivityGroup, string> = {
  PLATFORM: 'Platform services',
  MESSAGING: 'Messaging channels',
  PAYMENTS: 'Payments, banks & mobile money',
  DEVICES: 'Field & security systems',
  DATA: 'Data exchange',
};

const STATUS_STYLE: Record<
  ConnectivityStatus,
  { label: string; chip: string; dot: string; icon: LucideIcon }
> = {
  CONNECTED: {
    label: 'Connected',
    chip: 'bg-[#dff6dd] text-[#0b5a0b] ring-[#a7e0a4]',
    dot: 'bg-[#107c10]',
    icon: CheckCircle2,
  },
  CONSOLE: {
    label: 'Console (dev)',
    chip: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    icon: Settings2,
  },
  IDLE: {
    label: 'Wired · idle',
    chip: 'bg-[#eff6fc] text-[#004578] ring-[#c7e0f4]',
    dot: 'bg-[#0078d4]',
    icon: Activity,
  },
  DEGRADED: {
    label: 'Degraded',
    chip: 'bg-orange-50 text-orange-800 ring-orange-200',
    dot: 'bg-orange-500',
    icon: AlertTriangle,
  },
  NOT_CONFIGURED: {
    label: 'Not configured',
    chip: 'bg-[#f3f2f1] text-[#605e5c] ring-[#e1dfdd]',
    dot: 'bg-[#a19f9d]',
    icon: XCircle,
  },
  DEFERRED: {
    label: 'Deferred',
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    icon: Plug,
  },
};

function groupIcon(group: ConnectivityGroup): LucideIcon {
  switch (group) {
    case 'PLATFORM':
      return Server;
    case 'MESSAGING':
      return MessageSquare;
    case 'PAYMENTS':
      return CreditCard;
    case 'DEVICES':
      return Fingerprint;
    case 'DATA':
      return Database;
    default:
      return Plug;
  }
}

function systemIcon(system: ConnectivitySystem): LucideIcon {
  const code = system.code;
  if (code === 'sms') return MessageSquare;
  if (code === 'whatsapp') return MessageCircle;
  if (code === 'email') return Mail;
  if (code === 'cctv' || code === 'anpr') return Camera;
  if (code === 'payment-gateway' || code === 'banks' || code === 'mobile-money')
    return CreditCard;
  if (code === 'biometrics' || code === 'rfid') return Fingerprint;
  return groupIcon(system.group);
}

function StatusChip({ status }: { status: ConnectivityStatus }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.NOT_CONFIGURED;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${style.chip}`}
    >
      <Icon className="h-3 w-3" />
      {style.label}
    </span>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'no traffic yet';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return 'just now';
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function SystemCard({ system }: { system: ConnectivitySystem }) {
  const Icon = systemIcon(system);
  const style = STATUS_STYLE[system.status] ?? STATUS_STYLE.NOT_CONFIGURED;
  return (
    <GlassCard className="!p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1b1a19]">
              {system.name}
            </p>
            <p className="font-mono text-[11px] text-[#605e5c]">{system.code}</p>
          </div>
        </div>
        <StatusChip status={system.status} />
      </div>

      <p className="mt-2 text-xs text-[#323130]">{system.detail}</p>

      <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-[#edebe9] pt-2 text-[11px]">
        <div>
          <dt className="text-[#605e5c]">Traffic 24h</dt>
          <dd className="font-semibold text-[#1b1a19]">{system.activity24h}</dd>
        </div>
        <div>
          <dt className="text-[#605e5c]">Failures</dt>
          <dd
            className={`font-semibold ${
              system.failures24h > 0 ? 'text-orange-700' : 'text-[#1b1a19]'
            }`}
          >
            {system.failures24h}
          </dd>
        </div>
        <div>
          <dt className="text-[#605e5c]">Last activity</dt>
          <dd className="font-semibold text-[#1b1a19]">
            {timeAgo(system.lastActivityAt)}
          </dd>
        </div>
      </dl>

      <ul className="mt-2 space-y-0.5">
        {system.evidence.slice(0, 4).map((line) => (
          <li
            key={line}
            className="truncate font-mono text-[10px] text-[#605e5c]"
            title={line}
          >
            · {line}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium ${
            style.dot ? 'text-[#605e5c]' : 'text-[#605e5c]'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {system.live ? 'live transport' : 'no live transport'}
        </span>
        <Link
          href={system.href}
          className="text-[11px] font-medium text-[#0067b8] hover:text-[#004578]"
        >
          Open →
        </Link>
      </div>
    </GlassCard>
  );
}

export default function DeveloperConnectivityPage() {
  const [data, setData] = useState<ConnectivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDeveloperConnectivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byGroup = useMemo(() => {
    const map = new Map<ConnectivityGroup, ConnectivitySystem[]>();
    for (const system of data?.systems ?? []) {
      const list = map.get(system.group) ?? [];
      list.push(system);
      map.set(system.group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map(
      (g) => [g, map.get(g) ?? []] as const,
    );
  }, [data]);

  const summary = data?.summary;

  return (
    <DeveloperShell
      title="Connected systems"
      description="Is the whole platform talking to the systems it is supposed to talk to? Every row is evidence-based: live probes, transport config, 24h delivery/traffic rows, and device last-seen. Console means the code path works but nothing leaves the server."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '…' : 'Refresh'}
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Connected"
          value={loading ? '…' : (summary?.connected ?? 0)}
          hint={`of ${summary?.total ?? 0} systems`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="emerald"
        />
        <StatCard
          label="Console / dev"
          value={loading ? '…' : (summary?.console ?? 0)}
          hint="Not delivered to vendors"
          icon={<Settings2 className="h-4 w-4" />}
          accent="amber"
        />
        <StatCard
          label="Degraded"
          value={loading ? '…' : (summary?.degraded ?? 0)}
          hint="Errors in last 24h"
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={(summary?.degraded ?? 0) > 0 ? 'rose' : 'slate'}
        />
        <StatCard
          label="Not wired"
          value={
            loading
              ? '…'
              : `${(summary?.deferred ?? 0) + (summary?.notConfigured ?? 0)}`
          }
          hint={`${summary?.deferred ?? 0} deferred · ${summary?.notConfigured ?? 0} unconfigured`}
          icon={<Plug className="h-4 w-4" />}
          accent="slate"
        />
      </div>

      {data ? (
        <p className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-[#605e5c]">
          <span className="font-mono">
            Checked {new Date(data.generatedAt).toLocaleString()}
          </span>
          <span>· window {data.windowHours}h</span>
          <span>
            · {summary?.idle ?? 0} wired but idle
          </span>
          <span>· {summary?.traffic24h ?? 0} events</span>
          <span
            className={
              (summary?.failures24h ?? 0) > 0
                ? 'font-medium text-orange-700'
                : ''
            }
          >
            · {summary?.failures24h ?? 0} failures
          </span>
        </p>
      ) : null}

      {!loading && (data?.systems.length ?? 0) === 0 ? (
        <PanelEmpty
          icon={<Server className="h-4 w-4" />}
          title="No connectivity data"
          description="The connectivity probe returned no systems. Check that core-api can reach the integration-gateway."
        />
      ) : (
        <div className="space-y-6">
          {byGroup.map(([group, systems]) => (
            <section key={group}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                {GROUP_LABEL[group]}
                <span className="ml-1.5 font-normal normal-case tracking-normal">
                  ({systems.length})
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {systems.map((system) => (
                  <SystemCard key={system.code} system={system} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {(data?.notes ?? []).length > 0 ? (
        <div className="mt-6 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2">
          {data?.notes.map((note) => (
            <p key={note} className="text-[11px] text-[#605e5c]">
              · {note}
            </p>
          ))}
        </div>
      ) : null}
    </DeveloperShell>
  );
}
