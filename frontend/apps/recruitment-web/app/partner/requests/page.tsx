'use client';

import {
  createPartnerGuardSupplyRequest,
  getB2bPartnerMe,
  getB2bRequestOptions,
  listPartnerGuardSupplyRequests,
  type B2bPartnerProfile,
  type GuardSupplyRequest,
} from '@pssms/api-client';
import {
  clearPartnerSession,
  getPartnerSessionUser,
  getPartnerToken,
} from '@pssms/auth';
import {
  Award,
  BookOpen,
  FileText,
  Gauge,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CareersHero,
  CareersShell,
  Field,
  StatusPill,
  formatDate,
  inputClass,
} from '../../_components/careers-ui';

const URGENCY = [
  {
    value: 'STANDARD' as const,
    label: 'Standard',
    hint: 'Normal recruitment timeline',
  },
  {
    value: 'HIGH' as const,
    label: 'High',
    hint: 'Needed sooner than usual',
  },
  {
    value: 'CRITICAL' as const,
    label: 'Critical',
    hint: 'Immediate cover required',
  },
];

export default function PartnerRequestsPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<B2bPartnerProfile | null>(null);
  const [rows, setRows] = useState<GuardSupplyRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [guardCount, setGuardCount] = useState(8);
  const [siteLocation, setSiteLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [trainingNeeds, setTrainingNeeds] = useState('');
  const [urgency, setUrgency] = useState<'STANDARD' | 'HIGH' | 'CRITICAL'>(
    'STANDARD',
  );
  const [urgencyOptions, setUrgencyOptions] = useState(URGENCY);
  const [serviceTerms, setServiceTerms] = useState('');
  const [criteriaNotes, setCriteriaNotes] = useState('');
  const [experienceYearsMin, setExperienceYearsMin] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [genderPreference, setGenderPreference] = useState<
    'ANY' | 'MALE' | 'FEMALE' | 'UNSPECIFIED'
  >('ANY');
  const [militaryTrainingRequired, setMilitaryTrainingRequired] =
    useState(false);
  const [firearmTrainingRequired, setFirearmTrainingRequired] = useState(false);
  const [languages, setLanguages] = useState('');
  const [heightMinCm, setHeightMinCm] = useState('');
  const [healthConditionNotes, setHealthConditionNotes] = useState('');

  const refresh = useCallback(async () => {
    if (!getPartnerToken()) {
      router.replace('/partner/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [me, list, options] = await Promise.all([
        getB2bPartnerMe(),
        listPartnerGuardSupplyRequests(),
        getB2bRequestOptions().catch(() => null),
      ]);
      setPartner(me);
      setRows(list);
      if (options?.urgencies?.length) {
        setUrgencyOptions(
          options.urgencies.map((u) => ({
            value: u.value as 'STANDARD' | 'HIGH' | 'CRITICAL',
            label: u.label,
            hint: u.hint,
          })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPartnerGuardSupplyRequest({
        guardCount,
        siteLocation: siteLocation.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        qualifications: qualifications.trim(),
        trainingNeeds: trainingNeeds.trim(),
        urgency,
        serviceTerms: serviceTerms.trim(),
        criteriaNotes: criteriaNotes.trim() || undefined,
        experienceYearsMin: experienceYearsMin
          ? Number(experienceYearsMin)
          : undefined,
        ageMin: ageMin ? Number(ageMin) : undefined,
        ageMax: ageMax ? Number(ageMax) : undefined,
        genderPreference,
        militaryTrainingRequired,
        firearmTrainingRequired,
        languages: languages.trim() || undefined,
        heightMinCm: heightMinCm ? Number(heightMinCm) : undefined,
        healthConditionNotes: healthConditionNotes.trim() || undefined,
      });
      setSiteLocation('');
      setQualifications('');
      setTrainingNeeds('');
      setServiceTerms('');
      setCriteriaNotes('');
      setUrgency('STANDARD');
      setExperienceYearsMin('');
      setAgeMin('');
      setAgeMax('');
      setGenderPreference('ANY');
      setMilitaryTrainingRequired(false);
      setFirearmTrainingRequired(false);
      setLanguages('');
      setHeightMinCm('');
      setHealthConditionNotes('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    clearPartnerSession();
    router.replace('/partner/login');
  }

  const session = getPartnerSessionUser();
  const canSubmit = partner?.status === 'APPROVED';

  return (
    <CareersShell active="partner">
      <CareersHero
        bleed
        eyebrow="Portal 35.14 · B2B"
        title={partner ? partner.name : 'Guard supply requests'}
        subtitle={
          partner
            ? `${partner.code} · ${partner.status} — registered security companies request HIGHLINK guard recruitment (count, qualifications, location, training, urgency, service terms).`
            : (session?.email ?? 'Partner portal')
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#312e81]"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </>
        }
      />

      {partner?.status === 'PENDING' ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your partner account is pending HIGHLINK approval. You can sign in and
          view this page, but you cannot submit guard supply requests until
          recruitment approves the company.
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <form
          onSubmit={onCreate}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
              New recruitment request
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
              <Plus className="h-5 w-5 text-[#4f46e5]" />
              Request security guards
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Specify required number of guards, qualifications, location,
              training needs, urgency, and service terms. HIGHLINK HR triages
              own-company requests only.
            </p>
          </div>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Users className="h-4 w-4 text-[#4f46e5]" />
              Number of guards & location
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Required number of guards">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={guardCount}
                  onChange={(e) => setGuardCount(Number(e.target.value))}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Location / site">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    className={`${inputClass} pl-11`}
                    placeholder="City / site / region"
                    required
                    minLength={2}
                  />
                </div>
              </Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Cover start" hint="optional">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Cover end" hint="optional">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Award className="h-4 w-4 text-[#4f46e5]" />
              Qualifications &amp; profile criteria
            </p>
            <Field label="Required qualifications" hint="licence, shift, clearance">
              <textarea
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="e.g. Valid guard licence, night shift"
                required
                minLength={2}
              />
            </Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Min experience (years)">
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={experienceYearsMin}
                  onChange={(e) => setExperienceYearsMin(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 2"
                />
              </Field>
              <Field label="Age min">
                <input
                  type="number"
                  min={18}
                  max={70}
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Age max">
                <input
                  type="number"
                  min={18}
                  max={70}
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field
                label="Gender preference"
                hint="optional · where legally acceptable"
              >
                <select
                  value={genderPreference}
                  onChange={(e) =>
                    setGenderPreference(
                      e.target.value as typeof genderPreference,
                    )
                  }
                  className={inputClass}
                >
                  <option value="ANY">Any / no preference</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="UNSPECIFIED">Prefer not to specify</option>
                </select>
              </Field>
              <Field label="Min height (cm)">
                <input
                  type="number"
                  min={140}
                  max={220}
                  value={heightMinCm}
                  onChange={(e) => setHeightMinCm(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 165"
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Languages">
                <input
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Swahili, English"
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={militaryTrainingRequired}
                  onChange={(e) =>
                    setMilitaryTrainingRequired(e.target.checked)
                  }
                />
                Military training required
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={firearmTrainingRequired}
                  onChange={(e) =>
                    setFirearmTrainingRequired(e.target.checked)
                  }
                />
                Firearm training required
              </label>
            </div>
            <div className="mt-3">
              <Field label="Health / fitness notes">
                <textarea
                  value={healthConditionNotes}
                  onChange={(e) => setHealthConditionNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="e.g. Fit for standing duty; no mobility limits"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <BookOpen className="h-4 w-4 text-[#4f46e5]" />
              Training needs
            </p>
            <Field label="Training HIGHLINK should provide or confirm">
              <textarea
                value={trainingNeeds}
                onChange={(e) => setTrainingNeeds(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="e.g. Site induction, customer SOP, first aid"
                required
                minLength={2}
              />
            </Field>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Gauge className="h-4 w-4 text-[#4f46e5]" />
              Urgency
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {urgencyOptions.map((opt) => {
                const on = urgency === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgency(opt.value)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      on
                        ? 'border-[#4f46e5] bg-indigo-50 ring-2 ring-[#4f46e5]/20'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FileText className="h-4 w-4 text-[#4f46e5]" />
              Service terms
            </p>
            <Field label="Commercial / service terms">
              <textarea
                value={serviceTerms}
                onChange={(e) => setServiceTerms(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="e.g. 12-week cover, billed monthly, HIGHLINK uniforms on site"
                required
                minLength={2}
              />
            </Field>
            <div className="mt-3">
              <Field label="Additional notes" hint="optional">
                <textarea
                  value={criteriaNotes}
                  onChange={(e) => setCriteriaNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Anything else HIGHLINK recruitment should know"
                />
              </Field>
            </div>
          </section>

          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="w-full rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#312e81] px-4 py-3.5 text-base font-semibold text-white shadow disabled:opacity-60"
          >
            {!canSubmit
              ? 'Waiting for HIGHLINK approval'
              : busy
                ? 'Submitting…'
                : 'Submit recruitment request'}
          </button>
        </form>

        <section>
          <h2 className="mb-3 text-sm font-bold text-slate-900">
            Your requests ({rows.length})
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-10 text-center text-sm text-slate-500">
              No requests yet. Submit your first guard supply request.
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {r.referenceNumber}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusPill status={r.urgency ?? 'STANDARD'} />
                      <StatusPill status={r.status} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {r.guardCount} guards
                    {r.siteLocation ? ` · ${r.siteLocation}` : ''}
                    {r.startDate ? ` · from ${r.startDate}` : ''}
                    {` · ${formatDate(r.createdAt) ?? ''}`}
                  </p>
                  {r.qualifications ? (
                    <p className="mt-2 text-xs text-slate-700">
                      <span className="font-semibold">Qualifications:</span>{' '}
                      {r.qualifications}
                    </p>
                  ) : null}
                  {(r.experienceYearsMin != null ||
                    r.ageMin != null ||
                    r.ageMax != null ||
                    r.languages ||
                    r.heightMinCm != null) && (
                    <p className="mt-1 text-xs text-slate-700">
                      <span className="font-semibold">Profile:</span>{' '}
                      {[
                        r.experienceYearsMin != null
                          ? `≥${r.experienceYearsMin}y exp`
                          : null,
                        r.ageMin != null || r.ageMax != null
                          ? `age ${r.ageMin ?? '—'}-${r.ageMax ?? '—'}`
                          : null,
                        r.heightMinCm != null
                          ? `≥${r.heightMinCm} cm`
                          : null,
                        r.languages,
                        r.genderPreference &&
                        r.genderPreference !== 'ANY' &&
                        r.genderPreference !== 'UNSPECIFIED'
                          ? `gender ${r.genderPreference}`
                          : null,
                        r.militaryTrainingRequired ? 'military' : null,
                        r.firearmTrainingRequired ? 'firearm' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {r.healthConditionNotes ? (
                    <p className="mt-1 text-xs text-slate-700">
                      <span className="font-semibold">Health:</span>{' '}
                      {r.healthConditionNotes}
                    </p>
                  ) : null}
                  {r.trainingNeeds ? (
                    <p className="mt-1 text-xs text-slate-700">
                      <span className="font-semibold">Training:</span>{' '}
                      {r.trainingNeeds}
                    </p>
                  ) : null}
                  {r.serviceTerms ? (
                    <p className="mt-1 text-xs text-slate-700">
                      <span className="font-semibold">Terms:</span>{' '}
                      {r.serviceTerms}
                    </p>
                  ) : null}
                  {r.staffNotes ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      HR note: {r.staffNotes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CareersShell>
  );
}
