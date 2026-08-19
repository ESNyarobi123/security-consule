'use client';

import {
  getDeveloperApiSurface,
  getDeveloperCatalog,
  type DeveloperApiSurface,
  type DeveloperCatalog,
} from '@pssms/api-client';
import { GlassCard, btnSecondary } from '@pssms/ui';
import { BookOpen, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DeveloperShell } from '../_components/DeveloperShell';
import { PanelEmpty } from '../_components/shared';

function statusClass(status: string) {
  if (status === 'WIRED') return 'bg-emerald-50 text-emerald-800';
  if (status === 'CONSOLE') return 'bg-amber-50 text-amber-800';
  return 'bg-[#f3f2f1] text-[#605e5c]';
}

export default function DeveloperApisPage() {
  const [surface, setSurface] = useState<DeveloperApiSurface | null>(null);
  const [catalog, setCatalog] = useState<DeveloperCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [apis, topics] = await Promise.all([
        getDeveloperApiSurface(),
        getDeveloperCatalog(),
      ]);
      setSurface(apis);
      setCatalog(topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DeveloperShell
      title="APIs and channels"
      description="Swagger hosts (hostname only) and honest wiring for SMS, payments, WhatsApp, banks, and devices. Portal is not a microservice."
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

      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
        OpenAPI / Swagger
      </h2>
      {!surface && loading ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-[#e1dfdd] bg-white"
            />
          ))}
        </div>
      ) : !surface?.docs.length ? (
        <PanelEmpty
          icon={<BookOpen className="h-4 w-4" />}
          title="No API hosts"
          description="Core-api did not return documentation endpoints."
        />
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {surface.docs.map((row) => (
            <GlassCard key={row.code} className="!p-3">
              <p className="text-sm font-semibold text-[#1b1a19]">{row.name}</p>
              <p className="mt-1 font-mono text-[11px] text-[#605e5c]">
                {row.host ?? '—'}
                {row.docsPath ?? ''}
              </p>
              <p className="mt-2 text-xs text-[#605e5c]">{row.note}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {surface?.prefixes.length ? (
        <p className="mb-6 text-xs text-[#605e5c]">
          Prefixes:{' '}
          <span className="font-mono">{surface.prefixes.join(' · ')}</span>
        </p>
      ) : null}

      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
        Design catalog
      </h2>
      {catalog?.notes.map((n) => (
        <p key={n} className="mb-2 text-xs text-[#605e5c]">
          {n}
        </p>
      ))}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(catalog?.topics ?? []).map((topic) => (
          <GlassCard key={topic.id} className="!p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[#1b1a19]">{topic.name}</p>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusClass(topic.status)}`}
              >
                {topic.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#605e5c]">{topic.note}</p>
          </GlassCard>
        ))}
      </div>
    </DeveloperShell>
  );
}
