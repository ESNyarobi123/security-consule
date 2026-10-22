'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import {
  createBranchStaffMember,
  getBranchStaffRoster,
  listBranchStaff,
  updateBranchStaffMember,
  type BranchStaffMember,
  type BranchStaffPack,
  type BranchStaffRow,
} from '@pssms/api-client';
import {
  DataTable,
  Modal,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@pssms/ui';
import {
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  UserMinus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { BranchShell } from '../_components/BranchShell';
import { formatApiError, formatDate } from '../_components/shared';

type EmploymentType = BranchStaffMember['employmentType'];
type StaffStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED';

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  ADMIN: 'Office / admin',
  SUPERVISOR: 'Supervisor',
  OTHER: 'Other',
  GUARD: 'Guard',
};

/** Guard profiles are created in the Guards console / Recruitment, not here. */
const CREATABLE_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'ADMIN', label: 'Office / admin' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS: { value: StaffStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

type FormState = {
  fullName: string;
  employeeNumber: string;
  email: string;
  phone: string;
  department: string;
  employmentType: EmploymentType;
  branchId: string;
  hireDate: string;
  status: StaffStatus;
};

const emptyForm = (branchId = ''): FormState => ({
  fullName: '',
  employeeNumber: '',
  email: '',
  phone: '',
  department: '',
  employmentType: 'ADMIN',
  branchId,
  hireDate: new Date().toISOString().slice(0, 10),
  status: 'ACTIVE',
});

export default function BranchStaffPage() {
  const sessionUser = useMemo(() => getSessionUser(), []);
  const [pack, setPack] = useState<BranchStaffPack | null>(null);
  const [guardsOnPost, setGuardsOnPost] = useState<BranchStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [query, setQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BranchStaffMember | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staff, post] = await Promise.all([
        listBranchStaff({
          branchId: branchFilter || undefined,
          status: statusFilter || undefined,
          employmentType: typeFilter || undefined,
          q: query.trim() || undefined,
        }),
        getBranchStaffRoster().catch(() => ({ rows: [], notes: [] })),
      ]);
      setPack(staff);
      setGuardsOnPost(post.rows);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [branchFilter, statusFilter, typeFilter, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(pack?.branches[0]?.id ?? ''));
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (row: BranchStaffMember) => {
    setEditing(row);
    setForm({
      fullName: row.fullName,
      employeeNumber: row.employeeNumber,
      email: row.email ?? '',
      phone: row.phone ?? '',
      department: row.department ?? '',
      employmentType: row.employmentType,
      branchId: row.branchId ?? pack?.branches[0]?.id ?? '',
      hireDate: row.hireDate ? row.hireDate.slice(0, 10) : '',
      status:
        row.status === 'ON_LEAVE' || row.status === 'SUSPENDED'
          ? row.status
          : 'ACTIVE',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateBranchStaffMember(editing.id, {
          fullName: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          department: form.department.trim() || null,
          employmentType: form.employmentType,
          branchId: form.branchId || undefined,
          // Guard duty status must go through the Guards console — sending it
          // here would reject an otherwise valid profile edit.
          ...(editing.guardId ? {} : { status: form.status }),
        });
        setNotice(`${form.fullName} updated.`);
      } else {
        const created = await createBranchStaffMember({
          fullName: form.fullName.trim(),
          employeeNumber: form.employeeNumber.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          department: form.department.trim() || undefined,
          employmentType: form.employmentType,
          branchId: form.branchId || undefined,
          hireDate: form.hireDate || undefined,
        });
        setNotice(
          `${created.fullName} added as ${created.employeeNumber}.`,
        );
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: BranchStaffMember) => {
    if (row.guardId) {
      setError(
        'Guard duty status is changed in the Guards console so deployments, alertness and attendance stay consistent.',
      );
      return;
    }
    const next: StaffStatus = row.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setError(null);
    try {
      await updateBranchStaffMember(row.id, { status: next });
      setNotice(
        `${row.fullName} ${next === 'ACTIVE' ? 'reactivated' : 'suspended'}.`,
      );
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const rows = pack?.rows ?? [];
  const summary =
    pack?.summary ?? {
      total: 0,
      active: 0,
      onLeave: 0,
      suspended: 0,
      guards: 0,
    };

  return (
    <BranchShell
      title="Branch staff"
      description="Manage the staff posted to your branch (Regional / Branch / Operations Managers, Field Officers, Technical and Business Development Managers): add office staff, update their details or department, transfer between branches in your scope, and suspend / reactivate. HR hire & exit and guard duty status stay in their own consoles."
      actions={
        <>
          <button type="button" className={btnSecondary} onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button type="button" className={btnPrimary} onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add staff
          </button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Staff in branch" value={summary.total} hint="Excludes leavers" />
        <StatCard label="Active" value={summary.active} hint="On the roster" />
        <StatCard label="On leave" value={summary.onLeave} hint="Approved leave" />
        <StatCard label="Suspended" value={summary.suspended} hint="No duty" />
        <StatCard label="Guards" value={summary.guards} hint="Duty status in Guards console" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="Search name, number, email, phone, department"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`${inputCls} max-w-[190px]`}
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">All branches in scope</option>
          {(pack?.branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} · {b.name}
            </option>
          ))}
        </select>
        <select
          className={`${inputCls} max-w-[160px]`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className={`${inputCls} max-w-[160px]`}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#605e5c]">
          {rows.length} staff
          {loading ? ' · loading…' : ''}
        </span>
      </div>

      {error ? (
        <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <DataTable
        loading={loading}
        keyField="id"
        rows={rows}
        emptyMessage="No staff in your branch yet — use Add staff"
        columns={[
          { key: 'employeeNumber', label: 'Number' },
          {
            key: 'fullName',
            label: 'Name',
            render: (r) => (
              <div className="min-w-0">
                <p className="font-medium text-[#1b1a19]">{r.fullName}</p>
                <p className="truncate text-[11px] text-[#605e5c]">
                  {[r.email, r.phone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ),
          },
          {
            key: 'employmentType',
            label: 'Type',
            render: (r) => (
              <span className="text-xs font-medium text-[#323130]">
                {EMPLOYMENT_TYPE_LABELS[r.employmentType] ?? r.employmentType}
              </span>
            ),
          },
          { key: 'department', label: 'Department' },
          {
            key: 'branchId',
            label: 'Branch',
            render: (r) => (
              <span className="text-xs">
                {r.branchCode ? `${r.branchCode}` : '—'}
                {r.branchName ? (
                  <span className="text-[#605e5c]"> · {r.branchName}</span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <div className="flex flex-col gap-1">
                <StatusBadge status={r.status} />
                {r.guardId ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-sky-700">
                    <Shield className="h-3 w-3" /> Guard {r.guardStatus ?? ''}
                  </span>
                ) : null}
              </div>
            ),
          },
          {
            key: 'siteId',
            label: 'On post',
            render: (r) =>
              r.siteCode ? (
                <span className="text-xs">
                  {r.siteCode}
                  {r.siteName ? (
                    <span className="text-[#605e5c]"> · {r.siteName}</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-[#a19f9d]">—</span>
              ),
          },
          {
            key: 'hireDate',
            label: 'Hired',
            render: (r) => formatDate(r.hireDate),
          },
          {
            key: 'canEdit',
            label: 'Actions',
            render: (r) => (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => openEdit(r)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                {r.guardId ? (
                  can(sessionUser, 'guards.manage') ? (
                    <Link
                      href="/operations/guards"
                      className="text-xs font-semibold text-[#0078d4]"
                    >
                      Guards
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[#a19f9d]">
                      Duty: Guards console
                    </span>
                  )
                ) : r.status === 'SUSPENDED' ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void toggleStatus(r)}
                    title="Reactivate this staff member"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void toggleStatus(r)}
                    title="Suspend without deleting the record"
                  >
                    <UserMinus className="h-3 w-3" />
                    Suspend
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#605e5c]" />
          <h2 className="text-sm font-semibold text-[#1b1a19]">
            Guards on post
          </h2>
          <span className="text-[11px] text-[#605e5c]">
            Active deployments at sites in your scope
          </span>
        </div>
        <DataTable
          loading={loading}
          keyField="id"
          rows={guardsOnPost}
          emptyMessage="No active deployments in scope"
          columns={[
            { key: 'employeeNumber', label: 'Number' },
            { key: 'fullName', label: 'Name' },
            {
              key: 'guardStatus',
              label: 'Duty status',
              render: (r) => <StatusBadge status={r.guardStatus} />,
            },
            { key: 'siteCode', label: 'Site' },
            {
              key: 'siteName',
              label: 'Location',
            },
            {
              key: 'startDate',
              label: 'On post since',
              render: (r) => formatDate(r.startDate),
            },
          ]}
        />
        <p className="mt-2 text-[11px] text-[#605e5c]">
          Deploy / end posting:{' '}
          <Link href="/branch/deployments" className="font-semibold text-[#0078d4]">
            /branch/deployments
          </Link>
          {can(sessionUser, 'guards.manage')
            ? ' · Guard readiness / status: /operations/guards'
            : ' · Guard status/readiness needs guards.manage (Guards console)'}
          . Exits are HR Movements; payroll stays Payroll.
        </p>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.fullName}` : 'Add branch staff'}
      >
        <form onSubmit={submit} className="space-y-3">
          {formError ? (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {formError}
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#323130]">
              Full name
            </label>
            <input
              className={inputCls}
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#323130]">
                Employee number
              </label>
              <input
                className={inputCls}
                placeholder="Auto (EMP-####)"
                disabled={Boolean(editing)}
                value={form.employeeNumber}
                onChange={(e) =>
                  setForm({ ...form, employeeNumber: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#323130]">
                Branch
              </label>
              <select
                className={inputCls}
                required
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              >
                <option value="">Select branch</option>
                {(pack?.branches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#323130]">
                Employment type
              </label>
              <select
                className={inputCls}
                value={form.employmentType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employmentType: e.target.value as EmploymentType,
                  })
                }
              >
                {CREATABLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#323130]">
                Department
              </label>
              <input
                className={inputCls}
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#323130]">
                Email
              </label>
              <input
                className={inputCls}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#323130]">
                Phone
              </label>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {editing ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#323130]">
                  Status
                </label>
                <select
                  className={inputCls}
                  value={form.status}
                  disabled={Boolean(editing.guardId)}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as StaffStatus })
                  }
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {editing.guardId ? (
                  <p className="mt-1 text-[11px] text-[#605e5c]">
                    Guard duty status changes in the Guards console.
                  </p>
                ) : null}
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#323130]">
                  Hire date
                </label>
                <input
                  className={inputCls}
                  type="date"
                  value={form.hireDate}
                  onChange={(e) =>
                    setForm({ ...form, hireDate: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          <p className="rounded border border-[#e1dfdd] bg-[#faf9f8] px-3 py-2 text-[11px] leading-relaxed text-[#605e5c]">
            Guards are not added here — their profile and duty status come from
            the Guards console / Recruitment. Login accounts and roles stay in
            Super Admin → Users. Termination / exit is an HR Movement.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add staff'}
            </button>
          </div>
        </form>
      </Modal>
    </BranchShell>
  );
}
