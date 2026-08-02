'use client';

import {
  listGuards,
  updateGuardReadiness,
  updateGuardStatus,
  type Guard,
} from '@pssms/api-client';
import { AZURE, DataTable, StatusBadge } from '@pssms/ui';
import {
  BadgeCheck,
  ClipboardCheck,
  LayoutGrid,
  List,
  Plus,
  Rocket,
  RotateCw,
  Search,
  Shield,
  ShieldOff,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreateGuardModal } from './_components/CreateGuardModal';
import { GuardCard } from './_components/GuardCard';
import {
  GuardDetailDrawer,
  type GuardReadinessPatch,
} from './_components/GuardDetailDrawer';
import {
  FILTER_CHIPS,
  KpiCard,
  WALL,
  guardReadinessOk,
  matchesFilter,
  matchesSearch,
  readinessTone,
  type RosterFilter,
  type RosterView,
} from './_components/shared';

export default function OperationsGuardsPage() {
  const [rows, setRows] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [view, setView] = useState<RosterView>('cards');
  const [focus, setFocus] = useState<Guard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listGuards();
      setRows(list);
      setFocus((prev) =>
        prev ? list.find((g) => g.id === prev.id) ?? null : null,
      );
    } catch {
      setRows([]);
      setError('Could not load guard roster. Check auth and API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === 'ACTIVE').length;
    const deployable = rows.filter((r) => r.deploymentEligible).length;
    const suspended = rows.filter((r) => r.status === 'SUSPENDED').length;
    const readinessOk = rows.filter((r) => guardReadinessOk(r)).length;
    return { total, active, deployable, suspended, readinessOk };
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (g) => matchesFilter(g, filter) && matchesSearch(g, query),
      ),
    [rows, filter, query],
  );

  async function toggleSuspend(guard: Guard) {
    const next = guard.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setBusyId(guard.id);
    setError(null);
    try {
      await updateGuardStatus(guard.id, next);
      await load();
    } catch {
      setError('Status update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDeployable(guard: Guard) {
    if (guard.status !== 'ACTIVE') return;
    const makingDeployable = !guard.deploymentEligible;
    if (
      makingDeployable &&
      !guardReadinessOk(guard) &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Training and/or clearance are incomplete. Deployable is still allowed (G3 thin checklist does not hard-block). Continue?',
      )
    ) {
      return;
    }
    setBusyId(guard.id);
    setError(null);
    try {
      await updateGuardStatus(guard.id, guard.status, {
        deploymentEligible: makingDeployable,
      });
      await load();
    } catch {
      setError('Deployable toggle failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function saveReadiness(guard: Guard, patch: GuardReadinessPatch) {
    setBusyId(guard.id);
    setError(null);
    try {
      await updateGuardReadiness(guard.id, patch);
      await load();
    } catch {
      setError('Readiness update failed.');
      throw new Error('readiness failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pb-6">
      <section
        className="relative mb-5 overflow-hidden rounded-2xl shadow-md"
        style={{
          background: `linear-gradient(125deg, #071525 0%, ${AZURE.navy} 42%, #0b4f7a 78%, #0e7490 100%)`,
          border: '1px solid rgba(56, 189, 248, 0.28)',
        }}
      >
        <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span
                className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ring-2 ring-white/15"
                style={{
                  background:
                    'linear-gradient(145deg, #34d399 0%, #0078d4 55%, #0e7490 100%)',
                }}
              >
                <Shield className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sky-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 ring-1 ring-sky-300/30">
                    Guard Mgmt §8
                  </span>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-300/25">
                    Module 17 · G1–G3
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">
                  Security Guards
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                  Ops readiness roster — profile, thin checklist (training /
                  clearance / firearm), deployment eligibility. Full §8 matrix
                  and equipment remain HR + Assets.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/operations"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                ← Ops Console
              </a>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/40 bg-emerald-400/20 px-3 py-2 text-sm font-bold text-emerald-50 backdrop-blur-sm transition hover:bg-emerald-400/30"
              >
                <Plus className="h-4 w-4" />
                New guard
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300 disabled:opacity-60"
              >
                <RotateCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="Total"
              value={loading ? '…' : stats.total}
              hint="Registered guard profiles"
              tone="sky"
              icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
              label="Active"
              value={loading ? '…' : stats.active}
              hint={
                stats.total > 0
                  ? `${Math.round((stats.active / stats.total) * 100)}% of roster`
                  : 'No guards yet'
              }
              tone="emerald"
              icon={<BadgeCheck className="h-4 w-4" />}
            />
            <KpiCard
              label="Deployable"
              value={loading ? '…' : stats.deployable}
              hint="Eligible for field deployment"
              tone="teal"
              icon={<Rocket className="h-4 w-4" />}
            />
            <KpiCard
              label="Readiness OK"
              value={loading ? '…' : stats.readinessOk}
              hint="Training + clearance verified"
              tone="amber"
              icon={<ClipboardCheck className="h-4 w-4" />}
            />
            <KpiCard
              label="Suspended"
              value={loading ? '…' : stats.suspended}
              hint="Withheld from duty"
              tone="rose"
              icon={<ShieldOff className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl shadow-lg"
        style={{
          background: `linear-gradient(165deg, ${WALL.bg} 0%, #07101c 55%, ${WALL.bgSoft} 100%)`,
          border: `1px solid ${WALL.borderStrong}`,
        }}
      >
        <div
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          style={{ borderBottom: `1px solid ${WALL.border}` }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: WALL.muted }}
            >
              Readiness roster · {filtered.length}
              {filtered.length !== rows.length ? ` / ${rows.length}` : ''}
            </p>
          </div>
          <p className="font-mono text-[10px]" style={{ color: WALL.muted }}>
            HIGHLINK · CONTROL ROOM
          </p>
        </div>

        <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block min-w-0 flex-1 lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guard #, name, phone…"
                className="w-full rounded-lg border border-white/15 bg-black/25 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none ring-sky-400/40 focus:ring-2"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex flex-wrap rounded-lg border border-white/15 bg-black/20 p-0.5"
                role="group"
                aria-label="Status filter"
              >
                {FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFilter(chip.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                      filter === chip.id
                        ? 'bg-sky-400 text-[#072033] shadow'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div
                className="inline-flex rounded-lg border border-white/15 bg-black/20 p-0.5"
                role="group"
                aria-label="Roster view"
              >
                <button
                  type="button"
                  onClick={() => setView('cards')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    view === 'cards'
                      ? 'bg-sky-400 text-[#072033] shadow'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Card grid"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                    view === 'list'
                      ? 'bg-sky-400 text-[#072033] shadow'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Table list"
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-400/30">
              {error}
            </p>
          ) : null}

          {loading && rows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg px-6 py-16 text-center"
              style={{
                border: `1px dashed ${WALL.borderStrong}`,
                background: 'rgba(15, 33, 55, 0.5)',
              }}
            >
              <RotateCw className="h-7 w-7 animate-spin text-sky-300" />
              <p className="text-sm text-slate-300">Loading roster…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-4 rounded-lg px-6 py-16 text-center"
              style={{
                border: `1px dashed ${WALL.borderStrong}`,
                background: 'rgba(15, 33, 55, 0.5)',
              }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  border: `1px solid ${WALL.borderStrong}`,
                  background: WALL.panel,
                }}
              >
                <Shield className="h-7 w-7" style={{ color: WALL.muted }} />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  {rows.length === 0
                    ? 'No guards on the roster'
                    : 'No guards match this filter'}
                </p>
                <p
                  className="mx-auto mt-1 max-w-sm text-sm"
                  style={{ color: WALL.muted }}
                >
                  {rows.length === 0
                    ? 'Create a guard with New guard (link an IAM user), or refresh if you just seeded. Ops manages readiness — HR owns full employment records.'
                    : 'Try All, clear search, or adjust status chips.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {rows.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-emerald-300"
                  >
                    <Plus className="h-4 w-4" />
                    New guard
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-sm font-bold text-[#072033] shadow-md transition hover:bg-sky-300"
                >
                  <RotateCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
          ) : view === 'cards' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((g) => (
                <GuardCard
                  key={g.id}
                  guard={g}
                  busy={busyId === g.id}
                  onOpen={setFocus}
                  onToggleSuspend={(guard) => void toggleSuspend(guard)}
                  onToggleDeployable={(guard) => void toggleDeployable(guard)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg bg-white/95 shadow-inner">
              <DataTable
                loading={loading}
                keyField="id"
                rows={filtered}
                emptyMessage="No guards match."
                columns={[
                  {
                    key: 'employeeNumber',
                    label: 'Guard #',
                    render: (r) => (
                      <button
                        type="button"
                        onClick={() => setFocus(r)}
                        className="text-left font-medium text-[#0078d4] hover:underline"
                      >
                        {r.employeeNumber}
                      </button>
                    ),
                  },
                  {
                    key: 'fullName',
                    label: 'Name',
                    render: (r) => (
                      <span className="text-[#323130]">
                        {r.fullName?.trim() || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'phone',
                    label: 'Phone',
                    render: (r) => (
                      <span className="text-[#605e5c]">
                        {r.phone?.trim() || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                  {
                    key: 'deploymentEligible',
                    label: 'Deployable',
                    render: (r) =>
                      r.deploymentEligible ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#dff6dd] px-2 py-0.5 text-[11px] font-medium text-[#107c10]">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#605e5c]">
                          No
                        </span>
                      ),
                  },
                  {
                    key: 'trainingCompleted',
                    label: 'Checklist',
                    render: (r) => {
                      const ok = guardReadinessOk(r);
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                            ok
                              ? 'bg-[#dff6dd] text-[#107c10] ring-[#107c10]/25'
                              : 'bg-[#fff4ce] text-[#835c00] ring-[#835c00]/20'
                          }`}
                          title={readinessTone(r).label}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          {ok ? 'OK' : 'Incomplete'}
                        </span>
                      );
                    },
                  },
                  {
                    key: 'id',
                    label: 'Actions',
                    render: (r) => (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === r.id || r.status === 'TERMINATED'}
                          onClick={() => void toggleSuspend(r)}
                          className={
                            r.status === 'ACTIVE'
                              ? 'text-xs font-medium text-rose-600 hover:underline disabled:opacity-50'
                              : 'text-xs font-medium text-[#0067b8] hover:underline disabled:opacity-50'
                          }
                        >
                          {r.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id || r.status !== 'ACTIVE'}
                          onClick={() => void toggleDeployable(r)}
                          className="text-xs font-medium text-[#0078d4] hover:underline disabled:opacity-50"
                        >
                          {r.deploymentEligible ? 'Unset deploy' : 'Make deployable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFocus(r)}
                          className="text-xs font-medium text-[#605e5c] hover:underline"
                        >
                          Detail
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </section>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#605e5c]">
        Ops slices G1–G3: create, contract deploy, thin readiness checklist.
        Incomplete checklist does not hard-block deployable. Deferred: full
        Employment→CEO matrix, rich training records, firearm license CRUD.
      </p>

      {createOpen ? (
        <CreateGuardModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}

      {focus ? (
        <GuardDetailDrawer
          guard={focus}
          busy={busyId === focus.id}
          onClose={() => setFocus(null)}
          onToggleSuspend={(g) => void toggleSuspend(g)}
          onToggleDeployable={(g) => void toggleDeployable(g)}
          onSaveReadiness={saveReadiness}
        />
      ) : null}
    </div>
  );
}
