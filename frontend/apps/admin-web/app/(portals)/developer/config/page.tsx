'use client';

import {
  getDeveloperConfig,
  type DeveloperConfigStatus,
} from '@pssms/api-client';
import { GlassCard, btnSecondary } from '@pssms/ui';
import { RefreshCw, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

type ConfigCard = {
  key: string;
  label: string;
  value: string;
  group: string;
};

function boolLabel(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v ? 'yes' : 'no';
}

function cardsFromConfig(data: DeveloperConfigStatus): ConfigCard[] {
  const cards: ConfigCard[] = [
    {
      key: 'authMode',
      label: 'Auth mode',
      value: data.authMode,
      group: 'Runtime',
    },
    {
      key: 'nodeEnv',
      label: 'Node env',
      value: data.nodeEnv,
      group: 'Runtime',
    },
    {
      key: 'smsProvider',
      label: 'SMS provider',
      value: data.smsProvider,
      group: 'Providers',
    },
    {
      key: 'paymentProvider',
      label: 'Payment provider',
      value: data.paymentProvider,
      group: 'Providers',
    },
    {
      key: 'webhookVerify',
      label: 'Webhook verify',
      value: data.webhookVerify,
      group: 'Providers',
    },
    {
      key: 'integrationServiceTokenSet',
      label: 'Integration service token',
      value: data.integrationServiceTokenSet ? 'set' : 'missing',
      group: 'Providers',
    },
    {
      key: 'redisConfigured',
      label: 'Redis configured',
      value: boolLabel(data.brokers.redisConfigured),
      group: 'Brokers',
    },
    {
      key: 'redisTcpReachable',
      label: 'Redis reachable',
      value: boolLabel(data.brokers.redisTcpReachable),
      group: 'Brokers',
    },
    {
      key: 'rabbitmqConfigured',
      label: 'RabbitMQ configured',
      value: boolLabel(data.brokers.rabbitmqConfigured),
      group: 'Brokers',
    },
    {
      key: 'mqttConfigured',
      label: 'MQTT configured',
      value: boolLabel(data.brokers.mqttConfigured),
      group: 'Brokers',
    },
    {
      key: 'keycloakUrlPresent',
      label: 'Keycloak URL',
      value: boolLabel(data.brokers.keycloakUrlPresent),
      group: 'Brokers',
    },
  ];

  for (const [name, url] of Object.entries(data.gateways ?? {})) {
    cards.push({
      key: `gw:${name}`,
      label: name,
      value: url ?? '—',
      group: 'Gateways',
    });
  }

  return cards;
}

export default function DeveloperConfigPage() {
  const [data, setData] = useState<DeveloperConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDeveloperConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cards = useMemo(
    () => (data ? cardsFromConfig(data) : []),
    [data],
  );

  const byGroup = useMemo(() => {
    const map = new Map<string, ConfigCard[]>();
    for (const item of cards) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [cards]);

  return (
    <DeveloperShell
      title="Integration config"
      description="Read-only non-secret settings. Secrets never appear here."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className={btnSecondary}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      {error ? (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {data ? (
        <p className="mb-3 font-mono text-[11px] text-[#605e5c]">
          Checked {new Date(data.checkedAt).toLocaleString()}
        </p>
      ) : null}

      {cards.length === 0 && !loading ? (
        <PanelEmpty
          icon={<Settings2 className="h-4 w-4" />}
          title="No config"
          description="No non-secret configuration entries returned."
        />
      ) : (
        <div className="space-y-5">
          {byGroup.map(([group, rows]) => (
            <section key={group}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                {group}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((item) => (
                  <GlassCard key={item.key} className="!p-3">
                    <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[#605e5c]">
                      {item.label}
                    </p>
                    <p className="mt-1 break-all font-mono text-sm text-[#1b1a19]">
                      {item.value}
                    </p>
                  </GlassCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </DeveloperShell>
  );
}
