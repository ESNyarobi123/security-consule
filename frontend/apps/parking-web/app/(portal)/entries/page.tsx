'use client';

import {
  createParkingEntry,
  listEntries,
  listParkingSiteOptions,
  listParkingSpaces,
  listParkingVisitorAppointmentOptions,
  listVehicles,
  type ParkingOpsEntry,
  type ParkingOpsSpace,
  type ParkingOpsVehicle,
  type ParkingSiteOption,
  type ParkingVerificationMethod,
  type ParkingVisitorAppointmentOption,
} from '@pssms/api-client';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  VEHICLE_META,
  VehicleGlyph,
  normalizeVehicleType,
  type VehicleKind,
} from '../_components/parking-ui';

type DecisionFilter = 'ALL' | 'ALLOW' | 'DENY' | 'PENDING';
type DirectionFilter = 'ALL' | 'ENTRY' | 'EXIT';
type ViewMode = 'cards' | 'table';
type LookupMode = 'plate' | 'rfid';
type DecisionMode = 'AUTO' | 'ALLOW' | 'DENY';

const fieldCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function decisionTone(decision: string): string {
  switch (decision) {
    case 'ALLOW':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'DENY':
      return 'bg-rose-50 text-rose-800 ring-rose-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function directionTone(direction: string): string {
  return direction === 'EXIT'
    ? 'bg-sky-50 text-sky-800'
    : 'bg-teal-50 text-teal-800';
}

function newClientEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function EntriesPage() {
  const [entries, setEntries] = useState<ParkingOpsEntry[]>([]);
  const [vehicles, setVehicles] = useState<ParkingOpsVehicle[]>([]);
  const [sites, setSites] = useState<ParkingSiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('ALL');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<VehicleKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('cards');

  const [showForm, setShowForm] = useState(true);
  const [direction, setDirection] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [lookupMode, setLookupMode] = useState<LookupMode>('plate');
  const [siteId, setSiteId] = useState('');
  const [gateId, setGateId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [rfidTagRef, setRfidTagRef] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [decisionMode, setDecisionMode] = useState<DecisionMode>('AUTO');
  const [driverName, setDriverName] = useState('');
  const [driverIdRef, setDriverIdRef] = useState('');
  const [purposeOfVisit, setPurposeOfVisit] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<
    ParkingVerificationMethod | 'AUTO'
  >('AUTO');
  const [parkingSpaceId, setParkingSpaceId] = useState('');
  const [visitorAppointmentId, setVisitorAppointmentId] = useState('');
  const [spaces, setSpaces] = useState<ParkingOpsSpace[]>([]);
  const [appointments, setAppointments] = useState<
    ParkingVisitorAppointmentOption[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ParkingOpsEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, v, s, sp, ap] = await Promise.all([
        listEntries(),
        listVehicles(),
        listParkingSiteOptions().catch(() => [] as ParkingSiteOption[]),
        listParkingSpaces().catch(() => [] as ParkingOpsSpace[]),
        listParkingVisitorAppointmentOptions().catch(
          () => [] as ParkingVisitorAppointmentOption[],
        ),
      ]);
      setEntries(e);
      setVehicles(v.filter((x) => x.isActive));
      setSites(s);
      setSpaces(sp.filter((x) => x.isActive !== false));
      setAppointments(ap);
      setSiteId((prev) => {
        const next = prev && s.some((x) => x.id === prev) ? prev : (s[0]?.id ?? '');
        const site = s.find((x) => x.id === next);
        setGateId((gPrev) =>
          gPrev && site?.gates.some((g) => g.id === gPrev)
            ? gPrev
            : (site?.gates[0]?.id ?? ''),
        );
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === siteId) ?? null,
    [sites, siteId],
  );

  const vehicleByPlate = useMemo(() => {
    const m = new Map<string, ParkingOpsVehicle>();
    for (const v of vehicles) m.set(v.plateNumber.toUpperCase(), v);
    return m;
  }, [vehicles]);

  const enriched = useMemo(() => {
    return entries.map((e) => {
      const veh = vehicleByPlate.get(e.plateNumber.toUpperCase());
      const kind = normalizeVehicleType(veh?.vehicleType);
      return {
        ...e,
        site: e.siteName || e.siteCode || 'Site',
        gate: e.gateName || e.gateCode || null,
        kind,
        makeModel: [veh?.make, veh?.model].filter(Boolean).join(' ') || null,
        owner: veh?.ownerName || null,
      };
    });
  }, [entries, vehicleByPlate]);

  const counts = useMemo(() => {
    return {
      ALL: enriched.length,
      TODAY: enriched.filter((e) => isToday(e.recordedAt)).length,
      ALLOW: enriched.filter((e) => e.decision === 'ALLOW').length,
      DENY: enriched.filter((e) => e.decision === 'DENY').length,
      ENTRY: enriched.filter((e) => e.direction === 'ENTRY').length,
      EXIT: enriched.filter((e) => e.direction === 'EXIT').length,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((e) => {
      if (decisionFilter !== 'ALL' && e.decision !== decisionFilter) return false;
      if (directionFilter !== 'ALL' && e.direction !== directionFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && e.kind !== typeFilter) return false;
      if (!q) return true;
      return (
        e.plateNumber.toLowerCase().includes(q) ||
        e.site.toLowerCase().includes(q) ||
        (e.gate ?? '').toLowerCase().includes(q) ||
        e.decision.toLowerCase().includes(q) ||
        e.direction.toLowerCase().includes(q) ||
        (e.owner ?? '').toLowerCase().includes(q)
      );
    });
  }, [enriched, decisionFilter, directionFilter, typeFilter, search]);

  function onSiteChange(nextSiteId: string) {
    setSiteId(nextSiteId);
    const site = sites.find((s) => s.id === nextSiteId);
    setGateId(site?.gates[0]?.id ?? '');
  }

  function onVehiclePick(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) {
      setPlateNumber(v.plateNumber);
      if (v.rfidTagRef) setRfidTagRef(v.rfidTagRef);
      if (v.driverName) setDriverName(v.driverName);
      else if (v.ownerName) setDriverName(v.ownerName);
    }
  }

  const siteSpaces = useMemo(
    () => spaces.filter((s) => !siteId || s.siteId === siteId),
    [spaces, siteId],
  );

  const siteAppointments = useMemo(
    () => appointments.filter((a) => !siteId || a.siteId === siteId),
    [appointments, siteId],
  );

  async function submitPunch(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setLastResult(null);
    try {
      if (!siteId) {
        setFormError('Select a site');
        return;
      }
      const plate = plateNumber.trim().toUpperCase();
      const rfid = rfidTagRef.trim();
      if (lookupMode === 'plate' && plate.length < 3) {
        setFormError('Plate number must be at least 3 characters');
        return;
      }
      if (lookupMode === 'rfid' && rfid.length < 3) {
        setFormError('RFID tag must be at least 3 characters');
        return;
      }

      const created = await createParkingEntry({
        siteId,
        gateId: gateId || undefined,
        direction,
        ...(lookupMode === 'plate'
          ? { plateNumber: plate }
          : { rfidTagRef: rfid }),
        decision: decisionMode === 'AUTO' ? undefined : decisionMode,
        clientEventId: newClientEventId(),
        driverName: driverName.trim() || undefined,
        driverIdRef: driverIdRef.trim() || undefined,
        purposeOfVisit: purposeOfVisit.trim() || undefined,
        verificationMethod:
          verificationMethod === 'AUTO' ? undefined : verificationMethod,
        parkingSpaceId: parkingSpaceId || undefined,
        visitorAppointmentId: visitorAppointmentId || undefined,
      });

      setEntries((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      setLastResult(created);
      setPlateNumber('');
      setRfidTagRef('');
      setVehicleId('');
      setDriverName('');
      setDriverIdRef('');
      setPurposeOfVisit('');
      setVerificationMethod('AUTO');
      setParkingSpaceId('');
      setVisitorAppointmentId('');
      setDecisionMode('AUTO');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gate punch failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Enforcement · Modules 13-F / 13-K / 13-L
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
            Gate entries
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Full visit record: plate, driver, ID, org, bay, gates, times,
            officer, verification method, purpose, and visitor appointment when
            linked. EXIT pairs to an open ENTRY when found.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Hide form' : 'Record punch'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={(ev) => void submitPunch(ev)}
          className="rounded-2xl border border-slate-800 bg-[#0f2744] p-5 text-white shadow-lg"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Manual gate punch</h2>
              <p className="text-xs text-slate-300">
                Plate or RFID · site/gate · ENTRY/EXIT
              </p>
            </div>
            <div className="inline-flex rounded-lg bg-white/10 p-0.5">
              {(
                [
                  ['ENTRY', 'Entry', ArrowDownToLine],
                  ['EXIT', 'Exit', ArrowUpFromLine],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDirection(id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${
                    direction === id
                      ? id === 'ENTRY'
                        ? 'bg-teal-500 text-white'
                        : 'bg-sky-500 text-white'
                      : 'text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Site *
              </span>
              <select
                value={siteId}
                onChange={(e) => onSiteChange(e.target.value)}
                required
                className={fieldCls}
              >
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Gate (optional)
              </span>
              <select
                value={gateId}
                onChange={(e) => setGateId(e.target.value)}
                className={fieldCls}
                disabled={!selectedSite}
              >
                <option value="">— No gate —</option>
                {(selectedSite?.gates ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} · {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Lookup
              </span>
              <select
                value={lookupMode}
                onChange={(e) => setLookupMode(e.target.value as LookupMode)}
                className={fieldCls}
              >
                <option value="plate">Plate number</option>
                <option value="rfid">RFID tag</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Known vehicle (optional)
              </span>
              <select
                value={vehicleId}
                onChange={(e) => onVehiclePick(e.target.value)}
                className={fieldCls}
              >
                <option value="">— Type plate / RFID —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber}
                    {v.rfidTagRef ? ` · ${v.rfidTagRef}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {lookupMode === 'plate' ? (
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Plate *
                </span>
                <input
                  value={plateNumber}
                  onChange={(e) =>
                    setPlateNumber(e.target.value.toUpperCase())
                  }
                  required
                  minLength={3}
                  placeholder="T123ABC"
                  className={`${fieldCls} font-mono`}
                />
              </label>
            ) : (
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  RFID tag *
                </span>
                <input
                  value={rfidTagRef}
                  onChange={(e) => setRfidTagRef(e.target.value)}
                  required
                  minLength={3}
                  placeholder="RFID-DEMO-T123"
                  className={`${fieldCls} font-mono`}
                />
              </label>
            )}

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Decision
              </span>
              <select
                value={decisionMode}
                onChange={(e) =>
                  setDecisionMode(e.target.value as DecisionMode)
                }
                className={fieldCls}
              >
                <option value="AUTO">
                  Auto (permit / blacklist rules)
                </option>
                <option value="ALLOW">Force ALLOW</option>
                <option value="DENY">Force DENY</option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Driver name
              </span>
              <input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Defaults from vehicle"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Driver ID
              </span>
              <input
                value={driverIdRef}
                onChange={(e) => setDriverIdRef(e.target.value)}
                placeholder="NIDA / licence ref"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Verification method
              </span>
              <select
                value={verificationMethod}
                onChange={(e) =>
                  setVerificationMethod(
                    e.target.value as ParkingVerificationMethod | 'AUTO',
                  )
                }
                className={fieldCls}
              >
                <option value="AUTO">Auto (RFID if tag else Manual)</option>
                <option value="MANUAL">Manual</option>
                <option value="RFID">RFID</option>
                <option value="ANPR">ANPR</option>
                <option value="QR">QR</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Purpose of visit
              </span>
              <input
                value={purposeOfVisit}
                onChange={(e) => setPurposeOfVisit(e.target.value)}
                placeholder="Delivery, meeting, patrol…"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Parking space
              </span>
              <select
                value={parkingSpaceId}
                onChange={(e) => setParkingSpaceId(e.target.value)}
                className={fieldCls}
              >
                <option value="">— Optional bay —</option>
                {siteSpaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.spaceType}
                    {s.status !== 'AVAILABLE' ? ` (${s.status})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-300">
                Visitor appointment
              </span>
              <select
                value={visitorAppointmentId}
                onChange={(e) => setVisitorAppointmentId(e.target.value)}
                className={fieldCls}
              >
                <option value="">— None —</option>
                {siteAppointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.referenceNumber} · {a.visitorName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Auto ENTRY denies blacklist / expired / no permit (violations +
            FieldAlerts). Force ALLOW on a deny raises PARKING_FORCED_ENTRY.
            Duplicate open ENTRY raises PARKING_DUPLICATE_ENTRY.
          </p>

          {formError ? (
            <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              {formError}
            </p>
          ) : null}

          {lastResult ? (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                lastResult.decision === 'ALLOW'
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                  : 'border-rose-400/40 bg-rose-500/15 text-rose-100'
              }`}
            >
              <p>
                Recorded {lastResult.direction} · {lastResult.plateNumber} ·{' '}
                <strong>{lastResult.decision}</strong>
                {lastResult.siteCode ? ` @ ${lastResult.siteCode}` : ''}
                {lastResult.gateCode ? ` / ${lastResult.gateCode}` : ''}
              </p>
              {lastResult.fieldAlertIds &&
              lastResult.fieldAlertIds.length > 0 ? (
                <p className="mt-1 text-xs text-amber-100">
                  Ops FieldAlert raised ({lastResult.fieldAlertIds.length}) —
                  visible on Branch alerts / supervisor app.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving || !sites.length}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-bold text-white hover:bg-teal-400 disabled:opacity-60"
            >
              {direction === 'ENTRY' ? (
                <ArrowDownToLine className="h-4 w-4" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}
              {saving
                ? 'Recording…'
                : direction === 'ENTRY'
                  ? 'Record entry'
                  : 'Record exit'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total logs
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{counts.ALL}</p>
        </div>
        <div className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700/80">
            Today
          </p>
          <p className="mt-1 text-3xl font-bold text-teal-800">{counts.TODAY}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
            Allowed
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-800">{counts.ALLOW}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700/80">
            Denied
          </p>
          <p className="mt-1 text-3xl font-bold text-rose-800">{counts.DENY}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, site, gate, decision…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'All'],
              ['ALLOW', 'Allow'],
              ['DENY', 'Deny'],
              ['PENDING', 'Pending'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDecisionFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                decisionFilter === id
                  ? id === 'DENY'
                    ? 'bg-rose-600 text-white'
                    : id === 'ALLOW'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#2563eb] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
              {id !== 'ALL' && id !== 'PENDING' ? (
                <span className="ml-1 opacity-80">
                  ({id === 'ALLOW' ? counts.ALLOW : counts.DENY})
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['ALL', 'Both'],
              ['ENTRY', 'Entry'],
              ['EXIT', 'Exit'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDirectionFilter(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                directionFilter === id
                  ? 'bg-[#0d9488] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'CAR', 'MOTORCYCLE', 'TRUCK', 'BUS'] as const).map((t) => {
            const active = typeFilter === t;
            const meta = t === 'ALL' ? null : VEHICLE_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className="rounded-full px-3 py-1.5 text-xs font-bold transition"
                style={
                  active && meta
                    ? { background: meta.accent, color: '#fff' }
                    : active
                      ? { background: '#0f172a', color: '#fff' }
                      : {
                          background: meta?.soft ?? '#f1f5f9',
                          color: meta?.accent ?? '#475569',
                        }
                }
              >
                {t === 'ALL' ? 'All types' : meta!.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex rounded-xl border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              view === 'cards'
                ? 'bg-[#2563eb] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              view === 'table'
                ? 'bg-[#2563eb] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">
          Loading entries…
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-base font-semibold text-slate-700">
            No entries match
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Use the manual gate form or ANPR decide to create logs.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => {
            const meta = VEHICLE_META[e.kind];
            const DirIcon =
              e.direction === 'EXIT' ? ArrowUpFromLine : ArrowDownToLine;
            return (
              <article
                key={e.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
                style={{ borderColor: `${meta.accent}40` }}
              >
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: `linear-gradient(135deg, ${meta.soft} 0%, #ffffff 75%)`,
                  }}
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white"
                    style={{ boxShadow: `0 0 0 1px ${meta.accent}33` }}
                  >
                    <VehicleGlyph kind={e.kind} className="h-9 w-9" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${decisionTone(e.decision)}`}
                      >
                        {e.decision}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${directionTone(e.direction)}`}
                      >
                        <DirIcon className="h-3 w-3" />
                        {e.direction}
                      </span>
                    </div>
                    <p className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900">
                      {e.plateNumber}
                    </p>
                    <p
                      className="truncate text-xs font-semibold"
                      style={{ color: meta.accent }}
                    >
                      {meta.label}
                      {e.makeModel ? ` · ${e.makeModel}` : ''}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 px-4 py-3">
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0d9488]" />
                    <span className="font-medium">
                      {e.site}
                      {e.gate ? ` · ${e.gate}` : ''}
                      {e.parkingSpaceCode ? ` · bay ${e.parkingSpaceCode}` : ''}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {e.entryTime || e.exitTime
                      ? [
                          e.entryTime
                            ? `In ${formatWhen(e.entryTime)}${e.entryGateCode ? ` @ ${e.entryGateCode}` : ''}`
                            : null,
                          e.exitTime
                            ? `Out ${formatWhen(e.exitTime)}${e.exitGateCode ? ` @ ${e.exitGateCode}` : ''}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : formatWhen(e.recordedAt)}
                  </p>
                  {e.driverName ? (
                    <p className="text-xs text-slate-600">
                      Driver · {e.driverName}
                      {e.driverIdRef ? ` (${e.driverIdRef})` : ''}
                    </p>
                  ) : e.owner ? (
                    <p className="text-xs text-slate-400">Owner · {e.owner}</p>
                  ) : null}
                  {e.customerCode ? (
                    <p className="text-xs text-slate-400">
                      Org · {e.customerCode}
                      {e.customerName ? ` · ${e.customerName}` : ''}
                    </p>
                  ) : null}
                  {e.purposeOfVisit ? (
                    <p className="text-xs text-slate-400">
                      Purpose · {e.purposeOfVisit}
                    </p>
                  ) : null}
                  {e.recordedByName ? (
                    <p className="text-xs text-slate-400">
                      Officer · {e.recordedByName}
                      {e.verificationMethod
                        ? ` · ${e.verificationMethod}`
                        : ''}
                    </p>
                  ) : null}
                  {e.visitorReferenceNumber ? (
                    <p className="text-xs text-teal-700">
                      Visit · {e.visitorReferenceNumber}
                      {e.visitorName ? ` · ${e.visitorName}` : ''}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Dir</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Site / bay</th>
                <th className="px-4 py-3">In / out</th>
                <th className="px-4 py-3">Officer</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = VEHICLE_META[e.kind];
                return (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ background: meta.soft }}
                        >
                          <VehicleGlyph kind={e.kind} className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="font-mono font-bold text-slate-900">
                            {e.plateNumber}
                          </p>
                          <p
                            className="text-[11px] font-semibold"
                            style={{ color: meta.accent }}
                          >
                            {meta.label}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {e.driverName ?? e.owner ?? '—'}
                      {e.driverIdRef ? (
                        <span className="block text-slate-400">
                          {e.driverIdRef}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${directionTone(e.direction)}`}
                      >
                        {e.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${decisionTone(e.decision)}`}
                      >
                        {e.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {e.site}
                      {e.parkingSpaceCode ? (
                        <span className="block text-xs font-normal text-slate-500">
                          Bay {e.parkingSpaceCode}
                        </span>
                      ) : e.gate ? (
                        <span className="block text-xs font-normal text-slate-500">
                          {e.gate}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {e.entryTime ? (
                        <span className="block">In {formatWhen(e.entryTime)}</span>
                      ) : null}
                      {e.exitTime ? (
                        <span className="block">Out {formatWhen(e.exitTime)}</span>
                      ) : null}
                      {!e.entryTime && !e.exitTime
                        ? formatWhen(e.recordedAt)
                        : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {e.recordedByName ?? '—'}
                      {e.verificationMethod ? (
                        <span className="block text-slate-400">
                          {e.verificationMethod}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
