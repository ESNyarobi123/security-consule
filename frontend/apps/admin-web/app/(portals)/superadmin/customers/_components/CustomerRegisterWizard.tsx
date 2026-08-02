'use client';

import {
  createCustomer,
  listBranches,
  type Branch,
  type CreateCustomerBody,
  type Customer,
} from '@pssms/api-client';
import { btnPrimary, btnSecondary, inputCls, Modal } from '@pssms/ui';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STEPS = [
  { id: 'company', label: 'Company' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'services', label: 'Services' },
  { id: 'billing', label: 'Billing' },
  { id: 'review', label: 'Review' },
] as const;

const CATEGORIES = [
  'CORPORATE',
  'GOVERNMENT',
  'NGO',
  'RESIDENTIAL',
  'INDUSTRIAL',
  'VIP',
] as const;

const INDUSTRIES = [
  'Manufacturing',
  'Banking',
  'Mining',
  'Education',
  'Hospital',
  'Retail',
  'Telecom',
  'Logistics',
  'Hospitality',
  'Other',
] as const;

const SERVICE_TYPES = [
  { id: 'GUARD', label: 'Guard services' },
  { id: 'CCTV', label: 'CCTV / monitoring' },
  { id: 'VISITOR', label: 'Visitor management' },
  { id: 'PARKING', label: 'Parking' },
  { id: 'ACCESS', label: 'Access control' },
  { id: 'PATROL', label: 'Patrol' },
  { id: 'ALARM', label: 'Alarm response' },
] as const;

const REGIONS = [
  'Dar es Salaam',
  'Arusha',
  'Mwanza',
  'Dodoma',
  'Mbeya',
  'Morogoro',
  'Tanga',
  'Zanzibar',
  'Other',
] as const;

export type WizardForm = {
  code: string;
  name: string;
  tradingName: string;
  category: string;
  industry: string;
  ranking: string;
  tin: string;
  vrn: string;
  businessLicense: string;
  address: string;
  postalAddress: string;
  city: string;
  region: string;
  country: string;
  contactPerson: string;
  contactDesignation: string;
  phone: string;
  altPhone: string;
  billingEmail: string;
  opsEmail: string;
  website: string;
  serviceTypes: string[];
  preferredStartDate: string;
  estimatedGuards: string;
  specialRequirements: string;
  slaLevel: string;
  paymentTerms: string;
  paymentMethod: string;
  bankName: string;
  accountNumber: string;
  creditLimit: string;
  currency: string;
  invoiceFrequency: string;
  taxExempt: boolean;
  accountManagerName: string;
  branchId: string;
};

export const emptyWizardForm = (): WizardForm => ({
  code: '',
  name: '',
  tradingName: '',
  category: 'CORPORATE',
  industry: '',
  ranking: 'NORMAL',
  tin: '',
  vrn: '',
  businessLicense: '',
  address: '',
  postalAddress: '',
  city: '',
  region: 'Dar es Salaam',
  country: 'Tanzania',
  contactPerson: '',
  contactDesignation: '',
  phone: '',
  altPhone: '',
  billingEmail: '',
  opsEmail: '',
  website: '',
  serviceTypes: [],
  preferredStartDate: '',
  estimatedGuards: '',
  specialRequirements: '',
  slaLevel: 'STANDARD',
  paymentTerms: 'NET_30',
  paymentMethod: 'BANK_TRANSFER',
  bankName: '',
  accountNumber: '',
  creditLimit: '',
  currency: 'TZS',
  invoiceFrequency: 'MONTHLY',
  taxExempt: false,
  accountManagerName: '',
  branchId: '',
});

function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* plain */
  }
  return raw;
}

function opt(v: string): string | undefined {
  const t = v.trim();
  return t ? t : undefined;
}

function buildBody(form: WizardForm, saveAsDraft: boolean): CreateCustomerBody {
  return {
    code: opt(form.code),
    name: form.name.trim(),
    tradingName: opt(form.tradingName),
    category: opt(form.category),
    industry: opt(form.industry),
    ranking: opt(form.ranking),
    tin: opt(form.tin),
    vrn: opt(form.vrn),
    businessLicense: opt(form.businessLicense),
    address: opt(form.address),
    postalAddress: opt(form.postalAddress),
    city: opt(form.city),
    region: opt(form.region),
    country: opt(form.country) ?? 'Tanzania',
    contactPerson: opt(form.contactPerson),
    contactDesignation: opt(form.contactDesignation),
    phone: opt(form.phone),
    altPhone: opt(form.altPhone),
    billingEmail: opt(form.billingEmail),
    email: opt(form.billingEmail),
    opsEmail: opt(form.opsEmail),
    website: opt(form.website),
    serviceTypes: form.serviceTypes,
    preferredStartDate: opt(form.preferredStartDate),
    estimatedGuards: form.estimatedGuards.trim()
      ? Number(form.estimatedGuards)
      : undefined,
    specialRequirements: opt(form.specialRequirements),
    slaLevel: opt(form.slaLevel),
    paymentTerms: opt(form.paymentTerms),
    paymentMethod: opt(form.paymentMethod),
    bankName: opt(form.bankName),
    accountNumber: opt(form.accountNumber),
    creditLimit: form.creditLimit.trim()
      ? Number(form.creditLimit)
      : undefined,
    currency: opt(form.currency) ?? 'TZS',
    invoiceFrequency: opt(form.invoiceFrequency),
    taxExempt: form.taxExempt,
    accountManagerName: opt(form.accountManagerName),
    branchId: opt(form.branchId),
    saveAsDraft,
  };
}

function validateStep(step: number, form: WizardForm): string | null {
  if (step === 0) {
    if (form.name.trim().length < 2) return 'Company name is required';
    if (!form.category) return 'Customer category is required';
    if (!form.industry) return 'Industry / sector is required';
    if (!form.tin.trim()) return 'TIN is required';
    return null;
  }
  if (step === 1) {
    if (!form.address.trim()) return 'Physical address is required';
    if (!form.city.trim()) return 'City is required';
    if (!form.contactPerson.trim()) return 'Primary contact person is required';
    if (!form.contactDesignation.trim()) return 'Designation is required';
    if (!form.phone.trim()) return 'Primary phone is required';
    if (!form.billingEmail.trim()) return 'Billing email is required';
    return null;
  }
  if (step === 2) {
    if (form.serviceTypes.length === 0)
      return 'Select at least one service type';
    if (!form.slaLevel) return 'SLA level is required';
    return null;
  }
  if (step === 3) {
    if (!form.paymentTerms) return 'Payment terms are required';
    if (!form.invoiceFrequency) return 'Invoice frequency is required';
    if (!form.currency) return 'Currency is required';
    return null;
  }
  return null;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-[#323130]">
      {label}
      {required ? <span className="text-rose-600"> *</span> : null}
      {hint ? (
        <span className="ml-1 font-normal text-[#605e5c]">({hint})</span>
      ) : null}
      {children}
    </label>
  );
}

export function CustomerRegisterWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: Customer, goToContract: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [form, setForm] = useState<WizardForm>(emptyWizardForm);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Customer | null>(null);

  useEffect(() => {
    void listBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleService = (id: string) => {
    setForm((f) => ({
      ...f,
      serviceTypes: f.serviceTypes.includes(id)
        ? f.serviceTypes.filter((s) => s !== id)
        : [...f.serviceTypes, id],
    }));
  };

  const canJumpTo = (i: number) => i <= maxReached;

  function goNext() {
    const err = validateStep(step, form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const next = Math.min(step + 1, STEPS.length - 1);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit(opts: { draft: boolean; goContract: boolean }) {
    if (!opts.draft) {
      for (let i = 0; i < 4; i += 1) {
        const err = validateStep(i, form);
        if (err) {
          setError(err);
          setStep(i);
          return;
        }
      }
    } else if (form.name.trim().length < 2) {
      setError('Company name is required to save a draft');
      setStep(0);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const customer = await createCustomer(buildBody(form, opts.draft));
      setCreated(customer);
      onCreated(customer, opts.goContract);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const progressLabel = useMemo(
    () => `Step ${step + 1} of ${STEPS.length}`,
    [step],
  );

  if (created) {
    return (
      <Modal
        title="Customer registered"
        description={`${created.code} · ${created.name}`}
        onClose={onClose}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {created.status === 'PROSPECT'
              ? 'Saved as Prospect (draft). Complete profile later or activate when ready.'
              : 'Customer is Active and ready for sites, contracts, and portal setup.'}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href="/branch/sites"
              className={btnPrimary}
              onClick={onClose}
            >
              <MapPin className="h-4 w-4" />
              Add first site
            </Link>
            <Link
              href={`/superadmin/contracts?customerId=${created.id}`}
              className={btnSecondary}
              onClick={onClose}
            >
              <FileText className="h-4 w-4" />
              Create contract
            </Link>
            <button type="button" onClick={onClose} className={btnSecondary}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Register customer"
      description="Multi-step commercial registration — company, contacts, services, billing."
      onClose={onClose}
      size="xl"
    >
      {/* Stepper */}
      <ol className="mb-5 flex flex-wrap items-center gap-1 border-b border-[#edebe9] pb-4">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const clickable = canJumpTo(i);
          return (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable) {
                    setError(null);
                    setStep(i);
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                  current
                    ? 'bg-[#0078d4] text-white'
                    : done
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                      : clickable
                        ? 'bg-[#f3f2f1] text-[#605e5c] hover:bg-[#edebe9]'
                        : 'bg-[#faf9f8] text-[#a19f9d]'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    current
                      ? 'bg-white/20'
                      : done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-[#605e5c] ring-1 ring-[#e1dfdd]'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 ? (
                <span className="mx-0.5 hidden text-[#c8c6c4] sm:inline">→</span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">
        {progressLabel}
      </p>

      <div className="max-h-[min(58vh,520px)] space-y-4 overflow-y-auto pr-1">
        {step === 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer code" hint="auto if blank">
                <input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value.toUpperCase())}
                  className={inputCls}
                  placeholder="CUST-ACME-001"
                />
              </Field>
              <Field label="Ranking" required>
                <select
                  value={form.ranking}
                  onChange={(e) => set('ranking', e.target.value)}
                  className={inputCls}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="STRATEGIC">Strategic</option>
                  <option value="VIP">VIP</option>
                </select>
              </Field>
            </div>
            <Field label="Company name" required>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputCls}
                placeholder="ABC Industries Ltd"
              />
            </Field>
            <Field label="Trading name">
              <input
                value={form.tradingName}
                onChange={(e) => set('tradingName', e.target.value)}
                className={inputCls}
                placeholder="ABC Security Client"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" required>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className={inputCls}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Industry / sector" required>
                <select
                  value={form.industry}
                  onChange={(e) => set('industry', e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select…</option>
                  {INDUSTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="TIN" required>
                <input
                  value={form.tin}
                  onChange={(e) => set('tin', e.target.value)}
                  className={inputCls}
                  placeholder="100-000-000"
                />
              </Field>
              <Field label="VRN / VAT">
                <input
                  value={form.vrn}
                  onChange={(e) => set('vrn', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Business license">
                <input
                  value={form.businessLicense}
                  onChange={(e) => set('businessLicense', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Account manager">
                <input
                  value={form.accountManagerName}
                  onChange={(e) => set('accountManagerName', e.target.value)}
                  className={inputCls}
                  placeholder="BD officer name"
                />
              </Field>
              <Field label="Responsible branch">
                <select
                  value={form.branchId}
                  onChange={(e) => set('branchId', e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="Physical address" required>
              <textarea
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                className={`${inputCls} min-h-[64px] resize-y`}
                rows={2}
              />
            </Field>
            <Field label="Postal address">
              <input
                value={form.postalAddress}
                onChange={(e) => set('postalAddress', e.target.value)}
                className={inputCls}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="City" required>
                <input
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  className={inputCls}
                  placeholder="Dar es Salaam"
                />
              </Field>
              <Field label="Region" required>
                <select
                  value={form.region}
                  onChange={(e) => set('region', e.target.value)}
                  className={inputCls}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Country" required>
                <input
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary contact person" required>
                <input
                  value={form.contactPerson}
                  onChange={(e) => set('contactPerson', e.target.value)}
                  className={inputCls}
                  placeholder="Jane Mwangi"
                />
              </Field>
              <Field label="Designation" required>
                <input
                  value={form.contactDesignation}
                  onChange={(e) => set('contactDesignation', e.target.value)}
                  className={inputCls}
                  placeholder="Security Manager"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary phone" required>
                <input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className={inputCls}
                  placeholder="+255 700 000 000"
                />
              </Field>
              <Field label="Alternative phone">
                <input
                  value={form.altPhone}
                  onChange={(e) => set('altPhone', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Billing email" required>
                <input
                  type="email"
                  value={form.billingEmail}
                  onChange={(e) => set('billingEmail', e.target.value)}
                  className={inputCls}
                  placeholder="billing@company.com"
                />
              </Field>
              <Field label="Operations email">
                <input
                  type="email"
                  value={form.opsEmail}
                  onChange={(e) => set('opsEmail', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Website">
              <input
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                className={inputCls}
                placeholder="https://"
              />
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <p className="text-sm font-medium text-[#323130]">
                Service types <span className="text-rose-600">*</span>
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SERVICE_TYPES.map((s) => {
                  const on = form.serviceTypes.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                        on
                          ? 'border-[#0078d4] bg-[#eff6fc] text-[#004578]'
                          : 'border-[#e1dfdd] bg-white text-[#323130] hover:bg-[#faf9f8]'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          on
                            ? 'border-[#0078d4] bg-[#0078d4] text-white'
                            : 'border-[#8a8886]'
                        }`}
                      >
                        {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                      </span>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Preferred start date">
                <input
                  type="date"
                  value={form.preferredStartDate}
                  onChange={(e) => set('preferredStartDate', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Est. guards">
                <input
                  type="number"
                  min={0}
                  value={form.estimatedGuards}
                  onChange={(e) => set('estimatedGuards', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="SLA level" required>
                <select
                  value={form.slaLevel}
                  onChange={(e) => set('slaLevel', e.target.value)}
                  className={inputCls}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </Field>
            </div>
            <Field label="Special requirements">
              <textarea
                value={form.specialRequirements}
                onChange={(e) => set('specialRequirements', e.target.value)}
                className={`${inputCls} min-h-[72px] resize-y`}
                rows={3}
                placeholder="Night shift only, firearm posts, female guards…"
              />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment terms" required>
                <select
                  value={form.paymentTerms}
                  onChange={(e) => set('paymentTerms', e.target.value)}
                  className={inputCls}
                >
                  <option value="NET_15">Net 15</option>
                  <option value="NET_30">Net 30</option>
                  <option value="NET_45">Net 45</option>
                  <option value="NET_60">Net 60</option>
                  <option value="PREPAID">Prepaid</option>
                </select>
              </Field>
              <Field label="Payment method">
                <select
                  value={form.paymentMethod}
                  onChange={(e) => set('paymentMethod', e.target.value)}
                  className={inputCls}
                >
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank name">
                <input
                  value={form.bankName}
                  onChange={(e) => set('bankName', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Account number">
                <input
                  value={form.accountNumber}
                  onChange={(e) => set('accountNumber', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Credit limit">
                <input
                  type="number"
                  min={0}
                  value={form.creditLimit}
                  onChange={(e) => set('creditLimit', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Currency" required>
                <select
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}
                  className={inputCls}
                >
                  <option value="TZS">TZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Field>
              <Field label="Invoice frequency" required>
                <select
                  value={form.invoiceFrequency}
                  onChange={(e) => set('invoiceFrequency', e.target.value)}
                  className={inputCls}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#323130]">
              <input
                type="checkbox"
                checked={form.taxExempt}
                onChange={(e) => set('taxExempt', e.target.checked)}
                className="rounded border-[#8a8886]"
              />
              Tax exempt
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3 rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-4 text-sm">
            <p className="font-semibold text-[#1b1a19]">{form.name || '—'}</p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Code</dt>
                <dd>{form.code.trim() || 'Auto-generate on create'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Category</dt>
                <dd>
                  {form.category} · {form.industry || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">TIN</dt>
                <dd>{form.tin || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Contact</dt>
                <dd>
                  {form.contactPerson || '—'}
                  {form.contactDesignation
                    ? ` — ${form.contactDesignation}`
                    : ''}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase text-[#605e5c]">Address</dt>
                <dd>
                  {[form.address, form.city, form.region, form.country]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase text-[#605e5c]">Services</dt>
                <dd>{form.serviceTypes.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">Billing</dt>
                <dd>
                  {form.paymentTerms} · {form.invoiceFrequency} · {form.currency}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-[#605e5c]">SLA</dt>
                <dd>{form.slaLevel}</dd>
              </div>
            </dl>
            <p className="text-xs text-[#605e5c]">
              Documents and portal invite are available from the customer
              drawer after save. Sites under Branch Ops; contracts under Contracts.
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 border-t border-[#edebe9] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || submitting}
          className={btnSecondary}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit({ draft: true, goContract: false })}
            className={btnSecondary}
          >
            Save as draft
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={goNext} className={btnPrimary}>
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit({ draft: false, goContract: false })}
                className={btnPrimary}
              >
                <UserPlus className="h-4 w-4" />
                {submitting ? 'Creating…' : 'Create customer'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit({ draft: false, goContract: true })}
                className={btnSecondary}
              >
                Create & add contract
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
