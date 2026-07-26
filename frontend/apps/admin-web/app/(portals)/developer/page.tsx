'use client';

import {
  getPlatformServicesHealth,
  getProvidersHealth,
  listDevices,
  listIntegrationOutbox,
  listNotifications,
  listWebhookInbox,
  replayIntegrationOutbox,
  replayWebhookInbox,
  type Device,
  type IntegrationOutboxEntry,
  type NotificationRow,
  type PlatformServiceHealth,
  type ProviderAdapterHealth,
  type WebhookInboxEntry,
} from '@pssms/api-client';
import {
  DataTable,
  GlassCard,
  StatCard,
  StatusBadge,
  btnSecondary,
} from '@pssms/ui';
import {
  Bell,
  CheckCircle2,
  HardDrive,
  Inbox,
  Plug,
  RefreshCw,
  Send,
  Server,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DeveloperShell } from './_components/DeveloperShell';
import {
  AdapterCard,
  PanelEmpty,
  ServiceCard,
  categoryMeta,
  deviceIcon,
  isOnline,
} from './_components/shared';

const RECENT_LIMIT = 25;
const DEVICES_PREVIEW = 10;

const WEBHOOK_STATUSES = [
  'ALL',
  'FAILED',
  'DLQ',
  'RECEIVED',
  'PROCESSED',
] as const;
type WebhookStatusFilter = (typeof WEBHOOK_STATUSES)[number];

const OUTBOX_STATUSES = ['ALL', 'PENDING', 'FAILED'] as const;
type OutboxStatusFilter = (typeof OUTBOX_STATUSES)[number];

const filterSelectCls =
  'rounded-md border border-[#8a8886] bg-white px-2.5 py-1.5 text-xs text-[#323130] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]';

function SectionLabel({
  title,
  href,
  count,
  actions,
}: {
  title: string;
  href: string;
  count?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
        {title}
        {count != null ? (
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            ({count})
          </span>
        ) : null}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <Link
          href={href}
          className="text-[11px] font-medium text-[#0067b8] hover:text-[#004578]"
        >
          Open →
        </Link>
      </div>
    </div>
  );
}

export default function DeveloperOverviewPage() {
  const [services, setServices] = useState<PlatformServiceHealth[]>([]);
  const [adapters, setAdapters] = useState<ProviderAdapterHealth[]>([]);
  const [providersSource, setProvidersSource] = useState('');
  const [inbox, setInbox] = useState<WebhookInboxEntry[]>([]);
  const [outbox, setOutbox] = useState<IntegrationOutboxEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [webhookStatus, setWebhookStatus] =
    useState<WebhookStatusFilter>('ALL');
  const [outboxStatus, setOutboxStatus] = useState<OutboxStatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, providers, hooks, box, notifs, deviceRows] =
        await Promise.all([
          getPlatformServicesHealth(),
          getProvidersHealth(),
          listWebhookInbox(
            webhookStatus === 'ALL' ? undefined : webhookStatus,
          ),
          listIntegrationOutbox(
            outboxStatus === 'ALL' ? undefined : outboxStatus,
          ),
          listNotifications(),
          listDevices(),
        ]);
      setServices(health.services);
      setAdapters(providers.adapters);
      setProvidersSource(providers.source);
      setInbox(hooks);
      setOutbox(box);
      setNotifications(notifs);
      setDevices(deviceRows);
      if (providers.error) setError(providers.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [webhookStatus, outboxStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const online = services.filter((s) => isOnline(s.status)).length;
  const offline = services.filter((s) => s.status === 'down').length;
  const adaptersUp = adapters.filter((a) => a.status === 'UP').length;
  const recentNotifications = notifications.slice(0, RECENT_LIMIT);
  const devicePreview = devices.slice(0, DEVICES_PREVIEW);

  const adaptersByCategory = useMemo(() => {
    const map = new Map<string, ProviderAdapterHealth[]>();
    for (const adapter of adapters) {
      const key = adapter.category || 'OTHER';
      const list = map.get(key) ?? [];
      list.push(adapter);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [adapters]);

  const onReplayWebhook = async (id: string) => {
    setBusyId(id);
    try {
      await replayWebhookInbox(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const onReplayOutbox = async (id: string) => {
    setBusyId(id);
    try {
      await replayIntegrationOutbox(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DeveloperShell
      title="Integrations overview"
      description="All sections expanded. Use tabs for a focused page."
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Services"
          value={loading ? '…' : `${online}/${services.length}`}
          hint={offline > 0 ? `${offline} offline` : 'All up'}
          icon={
            offline > 0 ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )
          }
          accent={offline > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          label="Adapters"
          value={loading ? '…' : adaptersUp}
          hint={`${adapters.length} registered`}
          icon={<Plug className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Webhooks"
          value={loading ? '…' : inbox.length}
          hint="Inbox rows"
          icon={<Inbox className="h-4 w-4" />}
          accent="blue"
        />
        <StatCard
          label="Outbox"
          value={loading ? '…' : outbox.length}
          hint="Pending / failed"
          icon={<Send className="h-4 w-4" />}
          accent={outbox.length > 0 ? 'amber' : 'slate'}
        />
      </div>

      {/* Health */}
      <section className="mt-6">
        <SectionLabel
          title="Service health"
          href="/developer/health"
          count={services.length}
        />
        {services.length === 0 && !loading ? (
          <PanelEmpty
            icon={<Server className="h-4 w-4" />}
            title="No services"
            description="Health probes returned an empty list."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((row) => (
              <ServiceCard key={row.code} row={row} />
            ))}
          </div>
        )}
      </section>

      {/* Adapters */}
      <section className="mt-6">
        <SectionLabel
          title={
            providersSource
              ? `Provider adapters · ${providersSource}`
              : 'Provider adapters'
          }
          href="/developer/adapters"
          count={adapters.length}
        />
        {adapters.length === 0 && !loading ? (
          <PanelEmpty
            icon={<Plug className="h-4 w-4" />}
            title="No adapters"
            description="No provider adapters registered."
          />
        ) : (
          <div className="space-y-4">
            {adaptersByCategory.map(([category, rows]) => {
              const meta = categoryMeta(category);
              return (
                <div key={category}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#605e5c]">
                    {meta.label}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {rows.map((row) => (
                      <AdapterCard key={row.code} row={row} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Webhooks */}
      <section className="mt-6">
        <SectionLabel
          title="Webhook inbox"
          href="/developer/webhooks"
          count={inbox.length}
          actions={
            <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
              Status
              <select
                className={filterSelectCls}
                value={webhookStatus}
                onChange={(e) =>
                  setWebhookStatus(e.target.value as WebhookStatusFilter)
                }
              >
                {WEBHOOK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        <GlassCard className="!p-0 overflow-hidden">
          {inbox.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Inbox className="h-4 w-4" />}
                title="Inbox empty"
                description="No webhook events match this filter."
              />
            </div>
          ) : (
            <DataTable<WebhookInboxEntry>
              keyField="id"
              rows={inbox}
              emptyMessage="Inbox empty"
              columns={[
                {
                  key: 'provider',
                  label: 'Provider',
                  render: (row) => (
                    <span className="font-mono text-sm">{row.provider}</span>
                  ),
                },
                {
                  key: 'eventType',
                  label: 'Event',
                  render: (row) => (
                    <span className="text-sm">{row.eventType}</span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'signatureValid',
                  label: 'Sig',
                  render: (row) => (
                    <span
                      className={`text-xs font-medium ${
                        row.signatureValid
                          ? 'text-[#107c10]'
                          : 'text-rose-700'
                      }`}
                    >
                      {row.signatureValid ? 'Valid' : 'Invalid'}
                    </span>
                  ),
                },
                {
                  key: 'retryCount',
                  label: 'Retries',
                  render: (row) => (
                    <span className="text-xs">{row.retryCount}</span>
                  ),
                },
                {
                  key: 'errorMessage',
                  label: 'Error',
                  render: (row) => (
                    <span
                      className="max-w-[220px] truncate text-xs text-rose-700"
                      title={row.errorMessage ?? undefined}
                    >
                      {row.errorMessage ?? '—'}
                    </span>
                  ),
                },
                {
                  key: 'createdAt',
                  label: 'Created',
                  render: (row) => (
                    <span className="font-mono text-xs text-[#605e5c]">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'id',
                  label: '',
                  render: (row) => (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={
                        busyId === row.id ||
                        (row.status !== 'FAILED' && row.status !== 'DLQ')
                      }
                      onClick={() => void onReplayWebhook(row.id)}
                    >
                      Replay
                    </button>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      </section>

      {/* Outbox */}
      <section className="mt-6">
        <SectionLabel
          title="Integration outbox"
          href="/developer/outbox"
          count={outbox.length}
          actions={
            <label className="flex items-center gap-1.5 text-xs text-[#605e5c]">
              Status
              <select
                className={filterSelectCls}
                value={outboxStatus}
                onChange={(e) =>
                  setOutboxStatus(e.target.value as OutboxStatusFilter)
                }
              >
                {OUTBOX_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        <GlassCard className="!p-0 overflow-hidden">
          {outbox.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Send className="h-4 w-4" />}
                title="Outbox clear"
                description="No outbox rows match this filter."
              />
            </div>
          ) : (
            <DataTable<IntegrationOutboxEntry>
              keyField="id"
              rows={outbox}
              emptyMessage="No pending or failed outbox rows"
              columns={[
                {
                  key: 'eventType',
                  label: 'Event',
                  render: (row) => (
                    <span className="font-mono text-sm">{row.eventType}</span>
                  ),
                },
                {
                  key: 'aggregateType',
                  label: 'Aggregate',
                  render: (row) => (
                    <span className="text-xs text-[#605e5c]">
                      {row.aggregateType}:{row.aggregateId.slice(0, 8)}…
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'retryCount',
                  label: 'Retries',
                  render: (row) => (
                    <span className="text-xs">{row.retryCount}</span>
                  ),
                },
                {
                  key: 'errorMessage',
                  label: 'Error',
                  render: (row) => (
                    <span
                      className="max-w-[220px] truncate text-xs text-rose-700"
                      title={row.errorMessage ?? undefined}
                    >
                      {row.errorMessage ?? '—'}
                    </span>
                  ),
                },
                {
                  key: 'id',
                  label: '',
                  render: (row) => (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={
                        busyId === row.id ||
                        (row.status !== 'PENDING' && row.status !== 'FAILED')
                      }
                      onClick={() => void onReplayOutbox(row.id)}
                    >
                      Requeue
                    </button>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      </section>

      {/* Notifications */}
      <section className="mt-6">
        <SectionLabel
          title="Notifications"
          href="/developer/notifications"
          count={notifications.length}
        />
        <GlassCard className="!p-0 overflow-hidden">
          {recentNotifications.length === 0 && !loading ? (
            <div className="p-4">
              <PanelEmpty
                icon={<Bell className="h-4 w-4" />}
                title="No notifications"
                description="Nothing in the delivery queue yet."
              />
            </div>
          ) : (
            <DataTable<NotificationRow>
              keyField="id"
              rows={recentNotifications}
              emptyMessage="No notifications"
              columns={[
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: 'channel',
                  label: 'Channel',
                  render: (row) => (
                    <span className="text-xs uppercase tracking-wide text-[#605e5c]">
                      {row.channel}
                    </span>
                  ),
                },
                {
                  key: 'recipient',
                  label: 'Recipient',
                  render: (row) => (
                    <span className="font-mono text-sm">{row.recipient}</span>
                  ),
                },
                {
                  key: 'templateCode',
                  label: 'Template',
                  render: (row) => (
                    <span className="font-mono text-xs text-[#605e5c]">
                      {row.templateCode}
                    </span>
                  ),
                },
                {
                  key: 'createdAt',
                  label: 'Created',
                  render: (row) => (
                    <span className="font-mono text-xs text-[#605e5c]">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </GlassCard>
      </section>

      {/* Devices summary */}
      <section className="mt-6">
        <SectionLabel
          title="Devices"
          href="/devices"
          count={devices.length}
        />
        {devicePreview.length === 0 && !loading ? (
          <PanelEmpty
            icon={<HardDrive className="h-4 w-4" />}
            title="No devices"
            description="Register devices on the Devices portal."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {devicePreview.map((row) => {
              const Icon = deviceIcon(row.type);
              return (
                <Link
                  key={row.id}
                  href="/devices"
                  className="flex items-center gap-2.5 rounded-lg border border-[#e1dfdd] bg-white px-3 py-2.5 shadow-sm transition hover:border-[#0078d4]/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eff6fc] text-[#0078d4]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1b1a19]">
                      {row.name}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[#605e5c]">
                      {row.code} · {row.type}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </Link>
              );
            })}
          </div>
        )}
        {devices.length > DEVICES_PREVIEW ? (
          <p className="mt-2 text-[11px] text-[#605e5c]">
            Showing {DEVICES_PREVIEW} of {devices.length}. Full CRUD on{' '}
            <Link href="/devices" className="text-[#0078d4] underline">
              /devices
            </Link>
            .
          </p>
        ) : null}
      </section>
    </DeveloperShell>
  );
}
