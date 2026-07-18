'use client';

import {
  listAnprResults,
  listPermits,
  listViolations,
} from '@pssms/api-client';
import { PageHeader } from '@pssms/ui';
import { useCallback, useEffect, useState } from 'react';

export default function DashboardPage() {
  const [activePermits, setActivePermits] = useState(0);
  const [pendingAnpr, setPendingAnpr] = useState(0);
  const [violations, setViolations] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [permits, anpr, viols] = await Promise.all([
        listPermits('ACTIVE').catch(() => listPermits()),
        listAnprResults('PENDING').catch(() => listAnprResults()),
        listViolations(),
      ]);
      setActivePermits(
        permits.filter((p) => p.status === 'ACTIVE').length || permits.length,
      );
      setPendingAnpr(
        anpr.filter((r) => (r.decision ?? 'PENDING') === 'PENDING').length,
      );
      setViolations(viols.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Parking ops overview — ANPR metadata only (no video)"
      />

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <a
            href="/permits"
            className="rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Active permits
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {activePermits}
            </p>
          </a>
          <a
            href="/anpr"
            className="rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Pending ANPR
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {pendingAnpr}
            </p>
          </a>
          <a
            href="/violations"
            className="rounded-xl border border-[#e1dfdd] bg-white p-5 shadow-sm transition hover:border-[#0078d4] hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Violations
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {violations}
            </p>
          </a>
        </div>
      )}
    </>
  );
}
