'use client';

import {
  getSupplierMe,
  updateSupplierMe,
  type SupplierProfile,
} from '@pssms/api-client';
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DocumentStrip } from '../../_components/document-strip';
import {
  PortalError,
  PortalHero,
  PortalPanel,
  StatusPill,
  formatDate,
} from '../../_components/portal-ui';

const inputCls =
  'mt-1 w-full rounded-lg border border-[#c8c6c4] bg-white px-3 py-2 text-sm outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20';

export default function ProfilePage() {
  const [me, setMe] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    tin: '',
    vrn: '',
    address: '',
    category: 'GOODS',
    bankName: '',
    bankAccountName: '',
    bankAccountRef: '',
    mobileMoneyProvider: '',
    mobileMoneyRef: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await getSupplierMe();
      setMe(profile);
      setForm({
        name: profile.name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        tin: profile.tin ?? '',
        vrn: profile.vrn ?? '',
        address: profile.address ?? '',
        category: profile.category ?? 'GOODS',
        bankName: profile.bankName ?? '',
        bankAccountName: profile.bankAccountName ?? '',
        bankAccountRef: profile.bankAccountRef ?? '',
        mobileMoneyProvider: profile.mobileMoneyProvider ?? '',
        mobileMoneyRef: profile.mobileMoneyRef ?? '',
        contactPerson: profile.contactPerson ?? '',
        contactPhone: profile.contactPhone ?? '',
        contactEmail: profile.contactEmail ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateSupplierMe({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        tin: form.tin.trim() || undefined,
        vrn: form.vrn.trim() || undefined,
        address: form.address.trim() || undefined,
        category: form.category,
        bankName: form.bankName.trim() || undefined,
        bankAccountName: form.bankAccountName.trim() || undefined,
        bankAccountRef: form.bankAccountRef.trim() || undefined,
        mobileMoneyProvider: form.mobileMoneyProvider.trim() || undefined,
        mobileMoneyRef: form.mobileMoneyRef.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
      });
      setMe(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PortalHero
        eyebrow="Account"
        title="Company profile"
        subtitle="Keep registration, tax, bank and contact details current. HIGHLINK procurement sees the same record."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error ? <PortalError message={error} /> : null}

      {me?.status === 'PENDING' ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Registration is pending HIGHLINK approval. You can update details and
          upload licence / TIN / VRN now; quotes and invoices unlock after
          approval.
        </p>
      ) : null}
      {me?.status === 'REJECTED' ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Registration was rejected
          {me.rejectedReason ? `: ${me.rejectedReason}` : '.'} Update your
          details and wait for procurement to review again.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#605e5c]">Loading company profile…</p>
      ) : me ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div className="overflow-hidden rounded-2xl border border-[#e1dfdd] bg-white shadow-sm">
              <div className="bg-gradient-to-br from-[#0b1f3a] to-[#9a3412] px-5 py-6 text-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur">
                  {me.name.slice(0, 1).toUpperCase()}
                </div>
                <h2 className="mt-4 text-xl font-bold tracking-tight">
                  {me.name}
                </h2>
                <p className="mt-1 font-mono text-sm text-amber-100/90">
                  {me.code}
                </p>
                <div className="mt-3">
                  <StatusPill status={me.status} />
                </div>
              </div>
              <div className="space-y-2 px-5 py-4 text-xs text-[#605e5c]">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Own supplier record only
                </p>
                <p>Joined {formatDate(me.createdAt)}</p>
              </div>
            </div>
            <DocumentStrip
              resourceType="Supplier"
              resourceId={me.id}
              label="Licence, TIN & VRN"
              hint="Business licence, TIN, VRN or bank letter (PDF or image)."
            />
          </div>

          <div className="lg:col-span-2">
            <PortalPanel title="Registration details">
              <form onSubmit={onSave} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-[#323130]">
                    Legal / trading name
                    <input
                      className={inputCls}
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    Category
                    <select
                      className={inputCls}
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                    >
                      <option value="GOODS">Goods</option>
                      <option value="SERVICES">Services</option>
                      <option value="BOTH">Goods and services</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </span>
                    <input
                      className={inputCls}
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </span>
                    <input
                      className={inputCls}
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    TIN
                    <input
                      className={inputCls}
                      value={form.tin}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tin: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    VRN
                    <input
                      className={inputCls}
                      value={form.vrn}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, vrn: e.target.value }))
                      }
                    />
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-[#323130]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> Address
                    </span>
                    <input
                      className={inputCls}
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                    />
                  </label>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wide text-[#8a8886]">
                  Bank &amp; mobile money
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-[#323130]">
                    Bank name
                    <input
                      className={inputCls}
                      value={form.bankName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bankName: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    Account name
                    <input
                      className={inputCls}
                      value={form.bankAccountName}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          bankAccountName: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    Account number
                    <input
                      className={inputCls}
                      value={form.bankAccountRef}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          bankAccountRef: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    Mobile money
                    <input
                      className={inputCls}
                      placeholder="M-Pesa / TigoPesa ref"
                      value={form.mobileMoneyRef}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          mobileMoneyRef: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wide text-[#8a8886]">
                  Contact person
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-[#323130]">
                    Name
                    <input
                      className={inputCls}
                      value={form.contactPerson}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          contactPerson: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[#323130]">
                    Phone
                    <input
                      className={inputCls}
                      value={form.contactPhone}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          contactPhone: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="sm:col-span-2 text-sm font-medium text-[#323130]">
                    Email
                    <input
                      className={inputCls}
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          contactEmail: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                {saved ? (
                  <p className="text-sm text-emerald-700">Profile saved.</p>
                ) : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#ea580c] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            </PortalPanel>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-[#605e5c]">
              <Building2 className="h-3.5 w-3.5" />
              Access is limited to this supplier account. Company messages inbox
              is not in this slice.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#605e5c]">No profile loaded</p>
      )}
    </>
  );
}
