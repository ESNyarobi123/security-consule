'use client';

import {
  getProvidersHealth,
  pingProvider,
  type ProviderAdapterHealth,
} from '@pssms/api-client';
import { btnSecondary } from '@pssms/ui';
import { Plug, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { AdapterCard, PanelEmpty, categoryMeta } from '../_components/shared';

export default function DeveloperAdaptersPage() {
  const [adapters, setAdapters] = useState<ProviderAdapterHealth[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pingCode, setPingCode] = useState<string | null>(null);
  const [pingMsg, setPingMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const providers = await getProvidersHealth();
      setAdapters(providers.adapters);
      setSource(providers.source);
      if (providers.error) setError(providers.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ProviderAdapterHealth[]>();
    for (const adapter of adapters) {
      const key = adapter.category || 'OTHER';
      const list = map.get(key) ?? [];
      list.push(adapter);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [adapters]);

  const onPing = async (code: string) => {
    setPingCode(code);
    setPingMsg(null);
    try {
      const result = await pingProvider(code);
      const latency =
        result.latencyMs != null ? ` · ${result.latencyMs} ms` : '';
      setPingMsg(
        result.ok
          ? `${code}: OK${latency}${result.detail ? ` — ${result.detail}` : ''}`
          : `${code}: FAIL${latency}${result.detail ? ` — ${result.detail}` : ''}`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPingCode(null);
    }
  };

  return (
    <DeveloperShell
      title="Provider adapters"
      description={
        source
          ? `Registry source: ${source}`
          : 'SMS, payment, ANPR and other integration adapters.'
      }
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
      {pingMsg ? (
        <p className="mb-3 rounded border border-[#c7e0f4] bg-[#eff6fc] px-3 py-2 text-xs text-[#004578]">
          {pingMsg}
        </p>
      ) : null}

      {adapters.length === 0 && !loading ? (
        <PanelEmpty
          icon={<Plug className="h-4 w-4" />}
          title="No adapters"
          description="No provider adapters are registered yet."
        />
      ) : (
        <div className="space-y-5">
          {byCategory.map(([category, rows]) => {
            const meta = categoryMeta(category);
            return (
              <section key={category}>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
                  {meta.label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((row) => (
                    <AdapterCard
                      key={row.code}
                      row={row}
                      onPing={(code) => void onPing(code)}
                      pingBusy={pingCode === row.code}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </DeveloperShell>
  );
}
