'use client';

import {
  createUser,
  getPasswordPolicy,
  getUserAccess,
  listLoginHistory,
  listRoleChangeRequests,
  listRoles,
  listUsers,
  reactivateUser,
  resetUserMfa,
  resetUserPassword,
  setPasswordPolicy,
  setUserAccess,
  setUserRoles,
  submitUserReactivate,
  submitUserRoleChange,
  submitUserSuspend,
  suspendUser,
  type AccessBranch,
  type AccessSite,
  type AdminRole,
  type AdminUser,
  type IamChangeRequest,
  type LoginHistoryEntry,
  type PasswordPolicy,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import {
  FormEvent,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** Roles that need a separate invite/bind flow — not creatable here. */
const BOUND_EXTERNAL_ROLES = new Set([
  'CUSTOMER_PORTAL',
  'CUSTOMER_EMPLOYEE',
  'SUPPLIER_PORTAL',
  'OTHER_SECURITY_COMPANY',
  'VEHICLE_OWNER',
  'CONTRACTOR',
  'CONSULTANT',
  'SERVICE_PROVIDER',
]);

/** §4 A6 — only SUPER_ADMIN / GM may assign these (server enforces too). */
const PRIVILEGED_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'CEO',
  'CMD',
  'CISO',
]);

type StatusFilter = 'all' | 'active' | 'suspended';

function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      message?: string | string[];
      error?: { message?: string; code?: string };
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    /* plain text */
  }
  return raw;
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function SuperAdminUsersPage() {
  const session = getSessionUser();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('ChangeMe123!');
  const [createRole, setCreateRole] = useState('HR_OFFICER');
  const [createBusy, setCreateBusy] = useState(false);

  const [rolesUser, setRolesUser] = useState<AdminUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [rolesBusy, setRolesBusy] = useState(false);

  const [suspendUserRow, setSuspendUserRow] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const [resetUserRow, setResetUserRow] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('TempPass1!');

  const [policyOpen, setPolicyOpen] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyUserId, setHistoryUserId] = useState<string | undefined>();
  const [historyLabel, setHistoryLabel] = useState('All users');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'ok' | 'fail'>(
    'all',
  );
  const [historyRows, setHistoryRows] = useState<LoginHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [accessUser, setAccessUser] = useState<AdminUser | null>(null);
  const [accessBranches, setAccessBranches] = useState<AccessBranch[]>([]);
  const [accessSites, setAccessSites] = useState<AccessSite[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);

  const canAssignPrivileged = useMemo(() => {
    const r = session?.roles ?? [];
    return r.includes('SUPER_ADMIN') || r.includes('GENERAL_MANAGER');
  }, [session?.roles]);

  const [pendingRoleChanges, setPendingRoleChanges] = useState<
    IamChangeRequest[]
  >([]);

  const assignableRoles = useMemo(
    () =>
      roles.filter((r) => {
        if (BOUND_EXTERNAL_ROLES.has(r.code)) return false;
        if (!canAssignPrivileged && PRIVILEGED_ROLES.has(r.code)) return false;
        return true;
      }),
    [roles, canAssignPrivileged],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, roleRows, pending] = await Promise.all([
        listUsers(),
        listRoles(),
        listRoleChangeRequests('PENDING').catch(() => [] as IamChangeRequest[]),
      ]);
      setRows(users);
      setRoles(roleRows);
      setPendingRoleChanges(pending);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'suspended' && u.isActive) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.roles.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [rows, query, statusFilter]);

  const kpis = useMemo(() => {
    const active = rows.filter((u) => u.isActive).length;
    return {
      total: rows.length,
      active,
      suspended: rows.length - active,
    };
  }, [rows]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setError(null);
    try {
      await createUser({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        phone: phone.trim() || undefined,
        roleCodes: [createRole],
      });
      setShowCreate(false);
      setEmail('');
      setFullName('');
      setPhone('');
      setPassword('ChangeMe123!');
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setCreateBusy(false);
    }
  }

  function openRoles(user: AdminUser) {
    setRolesUser(user);
    setSelectedRoles([...user.roles]);
  }

  function toggleRole(code: string) {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function saveRoles() {
    if (!rolesUser) return;
    if (selectedRoles.length === 0) {
      setError('Select at least one role');
      return;
    }
    setRolesBusy(true);
    setError(null);
    try {
      if (canAssignPrivileged) {
        await setUserRoles(rolesUser.id, selectedRoles);
      } else {
        await submitUserRoleChange(rolesUser.id, selectedRoles);
      }
      setRolesUser(null);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setRolesBusy(false);
    }
  }

  async function confirmSuspend() {
    if (!suspendUserRow) return;
    setBusyId(suspendUserRow.id);
    setError(null);
    try {
      if (canAssignPrivileged) {
        await suspendUser(
          suspendUserRow.id,
          suspendReason.trim() || undefined,
        );
      } else {
        await submitUserSuspend(
          suspendUserRow.id,
          suspendReason.trim() || undefined,
        );
      }
      setSuspendUserRow(null);
      setSuspendReason('');
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onReactivate(user: AdminUser) {
    setBusyId(user.id);
    setError(null);
    try {
      if (canAssignPrivileged) {
        await reactivateUser(user.id);
      } else {
        await submitUserReactivate(user.id);
      }
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  function canResetPassword(user: AdminUser) {
    if (
      !canAssignPrivileged &&
      user.roles.some((r) => PRIVILEGED_ROLES.has(r))
    ) {
      return false;
    }
    return true;
  }

  async function confirmResetPassword() {
    if (!resetUserRow) return;
    setBusyId(resetUserRow.id);
    setError(null);
    try {
      await resetUserPassword(resetUserRow.id, resetPassword);
      setResetUserRow(null);
      setResetPassword('TempPass1!');
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function openPolicy() {
    setPolicyOpen(true);
    setError(null);
    try {
      setPolicy(await getPasswordPolicy());
    } catch (err) {
      setError(formatApiError(err));
      setPolicyOpen(false);
    }
  }

  async function savePolicy() {
    if (!policy) return;
    setPolicyBusy(true);
    setError(null);
    try {
      const saved = await setPasswordPolicy({
        minLength: policy.minLength,
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireDigit: policy.requireDigit,
        requireSymbol: policy.requireSymbol,
      });
      setPolicy(saved);
      setPolicyOpen(false);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setPolicyBusy(false);
    }
  }

  async function onResetMfa(user: AdminUser) {
    if (
      !window.confirm(
        `Clear MFA for ${user.fullName}? They can re-enroll from ESS Security.`,
      )
    ) {
      return;
    }
    setBusyId(user.id);
    setError(null);
    try {
      await resetUserMfa(user.id);
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  const loadHistory = useCallback(
    async (userId?: string, outcome: 'all' | 'ok' | 'fail' = 'all') => {
      setHistoryLoading(true);
      setError(null);
      try {
        const rows = await listLoginHistory({
          userId,
          success:
            outcome === 'all' ? undefined : outcome === 'ok' ? true : false,
          take: 100,
        });
        setHistoryRows(rows);
      } catch (err) {
        setError(formatApiError(err));
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  function openHistory(user?: AdminUser) {
    setHistoryUserId(user?.id);
    setHistoryLabel(user ? `${user.fullName} · ${user.email}` : 'All users');
    setHistoryFilter('all');
    setHistoryOpen(true);
    void loadHistory(user?.id, 'all');
  }

  function isExternalStaff(user: AdminUser) {
    return user.roles.some((r) => BOUND_EXTERNAL_ROLES.has(r));
  }

  function canEditAccess(user: AdminUser) {
    if (isExternalStaff(user)) return false;
    if (
      !canAssignPrivileged &&
      user.roles.some((r) => PRIVILEGED_ROLES.has(r))
    ) {
      return false;
    }
    return true;
  }

  async function openAccess(user: AdminUser) {
    setAccessUser(user);
    setAccessLoading(true);
    setError(null);
    try {
      const access = await getUserAccess(user.id);
      setAccessBranches(access.catalog.branches);
      setAccessSites(access.catalog.sites);
      setSelectedBranchIds([...access.branchIds]);
      setSelectedSiteIds([...access.siteIds]);
    } catch (err) {
      setAccessUser(null);
      setError(formatApiError(err));
    } finally {
      setAccessLoading(false);
    }
  }

  function toggleId(
    id: string,
    setter: Dispatch<SetStateAction<string[]>>,
  ) {
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function saveAccess() {
    if (!accessUser) return;
    setAccessBusy(true);
    setError(null);
    try {
      await setUserAccess(accessUser.id, {
        branchIds: selectedBranchIds,
        siteIds: selectedSiteIds,
      });
      setAccessUser(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setAccessBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Module 5 · Administration
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create staff accounts, assign roles, suspend or reactivate. Portal
            invites (customer/supplier/partner) stay on their own flows.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => openHistory()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Login history
          </button>
          <button
            type="button"
            onClick={() => void openPolicy()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Password policy
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#106ebe]"
          >
            New user
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total', value: kpis.total },
          { label: 'Active', value: kpis.active },
          { label: 'Suspended', value: kpis.suspended },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {k.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {loading ? '—' : k.value}
            </p>
          </div>
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {pendingRoleChanges.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            {pendingRoleChanges.length} pending IAM change request
            {pendingRoleChanges.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {pendingRoleChanges.slice(0, 5).map((r) => (
              <li key={r.id}>
                {r.changeType === 'SUSPEND' || r.changeType === 'REACTIVATE'
                  ? `${r.targetFullName ?? r.targetUserId.slice(0, 8)} · ${r.changeType}${r.reason ? ` (${r.reason})` : ''}`
                  : `${r.targetFullName ?? r.targetUserId.slice(0, 8)} → ${r.proposedRoleCodes.join(', ')}`}{' '}
                <span className="text-amber-800/80">
                  (approve as GM on /approvals)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, role…"
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0078d4]"
        />
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['suspended', 'Suspended'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                statusFilter === id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading users…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isSelf = session?.id === u.id;
                return (
                  <tr key={u.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{u.fullName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      {u.phone ? (
                        <p className="text-xs text-slate-400">{u.phone}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <div>
                          <span className="text-xs font-semibold uppercase text-emerald-700">
                            Active
                          </span>
                          {u.mustChangePassword ? (
                            <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                              Must change password
                            </p>
                          ) : null}
                          {u.mfaEnabled ? (
                            <p className="mt-0.5 text-[11px] font-medium text-sky-700">
                              MFA on
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs font-semibold uppercase text-rose-700">
                            Suspended
                          </span>
                          {u.suspendedReason ? (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {u.suspendedReason}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {fmtDate(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openHistory(u)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Logins
                        </button>
                        <button
                          type="button"
                          onClick={() => openRoles(u)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Roles
                        </button>
                        <button
                          type="button"
                          disabled={!canEditAccess(u)}
                          title={
                            isExternalStaff(u)
                              ? 'External accounts use party binding'
                              : !canAssignPrivileged &&
                                  u.roles.some((r) => PRIVILEGED_ROLES.has(r))
                                ? 'A6 — only SUPER_ADMIN/GM may edit privileged ACL'
                                : 'Site / branch ACL'
                          }
                          onClick={() => void openAccess(u)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          Sites
                        </button>
                        <button
                          type="button"
                          disabled={
                            isSelf ||
                            busyId === u.id ||
                            !canResetPassword(u)
                          }
                          title={
                            isSelf
                              ? 'Use ESS / change-password for your own account'
                              : !canResetPassword(u)
                                ? 'A6 — only SUPER_ADMIN/GM may reset privileged passwords'
                                : 'Set temporary password (must change on login; clears MFA)'
                          }
                          onClick={() => {
                            setResetUserRow(u);
                            setResetPassword('TempPass1!');
                          }}
                          className="rounded border border-amber-200 px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-40"
                        >
                          Reset PW
                        </button>
                        <button
                          type="button"
                          disabled={
                            isSelf ||
                            busyId === u.id ||
                            !canResetPassword(u) ||
                            !u.mfaEnabled
                          }
                          title={
                            isSelf
                              ? 'Use ESS Security to manage your own MFA'
                              : !canResetPassword(u)
                                ? 'A6 — only SUPER_ADMIN/GM may reset privileged MFA'
                                : !u.mfaEnabled
                                  ? 'MFA is not enabled'
                                  : 'Clear TOTP MFA enrollment'
                          }
                          onClick={() => void onResetMfa(u)}
                          className="rounded border border-sky-200 px-2 py-1 text-xs text-sky-800 hover:bg-sky-50 disabled:opacity-40"
                        >
                          Reset MFA
                        </button>
                        {u.isActive ? (
                          <button
                            type="button"
                            disabled={isSelf || busyId === u.id}
                            onClick={() => {
                              setSuspendUserRow(u);
                              setSuspendReason('');
                            }}
                            className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            title={
                              canAssignPrivileged
                                ? 'SUPER_ADMIN / GM — reactivate immediately'
                                : 'Submit for GM approval'
                            }
                            onClick={() => void onReactivate(u)}
                            className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                          >
                            {canAssignPrivileged
                              ? 'Reactivate'
                              : 'Request reactivate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No users match this filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Gated by <code className="text-slate-500">users.manage</code>. Privileged
        roles (SUPER_ADMIN/GM/CEO/CMD/CISO) follow elevation ceiling A6. Site/branch
        ACL applies on next login/refresh (A7). Role/suspend/reactivate for IT/CISO go
        through GM approval (M5-E/F/G). Password/MFA reset (M5-I/J). Org password
        policy editable by SUPER_ADMIN/GM (M5-K). Deferred: full SysAdmin→CMD matrix.
      </p>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={onCreate}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">New user</h2>
            <p className="mt-1 text-sm text-slate-500">
              Temporary password (min 10 chars: upper, lower, digit, symbol).
              User must change it on first login (M5-H).
            </p>
            <label className="mt-4 block text-sm text-slate-600">
              Full name
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-600">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-600">
              Phone (optional)
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-600">
              Temporary password
              <input
                required
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-600">
              Primary role
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createBusy}
                className="rounded-md bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createBusy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {rolesUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Set roles</h2>
            <p className="mt-1 text-sm text-slate-500">
              {rolesUser.fullName} · {rolesUser.email}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {canAssignPrivileged
                ? 'SUPER_ADMIN / GM — apply immediately (break-glass).'
                : 'Submitted for GENERAL_MANAGER approval (creator ≠ approver).'}
            </p>
            <div className="mt-4 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {assignableRoles.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.code)}
                    onChange={() => toggleRole(r.code)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm font-medium text-slate-900">
                      {r.code}
                    </span>
                    <span className="block text-xs text-slate-500">{r.name}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRolesUser(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rolesBusy}
                onClick={() => void saveRoles()}
                className="rounded-md bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {rolesBusy
                  ? 'Working…'
                  : canAssignPrivileged
                    ? 'Apply roles'
                    : 'Submit for approval'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {suspendUserRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Suspend user
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {suspendUserRow.fullName} will be blocked from login.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {canAssignPrivileged
                ? 'SUPER_ADMIN / GM — suspend immediately (break-glass).'
                : 'Submitted for GENERAL_MANAGER approval (creator ≠ approver).'}
            </p>
            <label className="mt-4 block text-sm text-slate-600">
              Reason (optional)
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSuspendUserRow(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === suspendUserRow.id}
                onClick={() => void confirmSuspend()}
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {canAssignPrivileged ? 'Suspend now' : 'Submit for approval'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {policyOpen && policy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Password policy
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Applies to create, reset, and change-password for this organization.
              {canAssignPrivileged
                ? ' SUPER_ADMIN / GM may edit.'
                : ' View only — ask SUPER_ADMIN / GM to change.'}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-600">
              {policy.summary ?? '—'}
            </p>
            <label className="mt-4 block text-sm text-slate-600">
              Minimum length
              <input
                type="number"
                min={8}
                max={128}
                disabled={!canAssignPrivileged}
                value={policy.minLength}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    minLength: Number(e.target.value) || 8,
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {(
                [
                  ['requireUppercase', 'Uppercase letter'],
                  ['requireLowercase', 'Lowercase letter'],
                  ['requireDigit', 'Digit'],
                  ['requireSymbol', 'Symbol'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!canAssignPrivileged}
                    checked={policy[key]}
                    onChange={(e) =>
                      setPolicy({ ...policy, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPolicyOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Close
              </button>
              {canAssignPrivileged ? (
                <button
                  type="button"
                  disabled={policyBusy}
                  onClick={() => void savePolicy()}
                  className="rounded-md bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {policyBusy ? 'Saving…' : 'Save policy'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {resetUserRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Reset password
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {resetUserRow.fullName} must change this temporary password on next
              login. MFA is cleared if enabled.
            </p>
            <label className="mt-4 block text-sm text-slate-600">
              Temporary password
              <input
                type="text"
                required
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-500">
              Min 10 chars with upper, lower, digit, and symbol.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetUserRow(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === resetUserRow.id || resetPassword.length < 8}
                onClick={() => void confirmResetPassword()}
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busyId === resetUserRow.id ? 'Saving…' : 'Reset password'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {accessUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Site / branch access
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {accessUser.fullName} · {accessUser.email}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Empty both = fail-closed (no sites). Branch grant expands to all
              sites under that branch at login (A7).
            </p>
            {accessLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-auto">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Branches
                  </p>
                  <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
                    {accessBranches.length === 0 ? (
                      <p className="text-xs text-slate-500">No branches.</p>
                    ) : (
                      accessBranches.map((b) => (
                        <label
                          key={b.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBranchIds.includes(b.id)}
                            onChange={() =>
                              toggleId(b.id, setSelectedBranchIds)
                            }
                          />
                          <span className="font-mono text-xs text-slate-500">
                            {b.code}
                          </span>
                          <span>{b.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sites (direct)
                  </p>
                  <div className="mt-2 max-h-48 space-y-1 overflow-auto rounded-lg border border-slate-200 p-2">
                    {accessSites.length === 0 ? (
                      <p className="text-xs text-slate-500">No sites.</p>
                    ) : (
                      accessSites.map((s) => (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSiteIds.includes(s.id)}
                            onChange={() => toggleId(s.id, setSelectedSiteIds)}
                          />
                          <span className="font-mono text-xs text-slate-500">
                            {s.code}
                          </span>
                          <span>{s.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAccessUser(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={accessBusy || accessLoading}
                onClick={() => void saveAccess()}
                className="rounded-md bg-[#0078d4] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save access
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Login history
                </h2>
                <p className="mt-1 text-sm text-slate-500">{historyLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>
            <div className="mt-3 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 self-start">
              {(
                [
                  ['all', 'All'],
                  ['ok', 'Success'],
                  ['fail', 'Failed'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setHistoryFilter(id);
                    void loadHistory(historyUserId, id);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    historyFilter === id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
              {historyLoading ? (
                <p className="p-4 text-sm text-slate-500">Loading…</p>
              ) : historyRows.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No login attempts yet.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">User</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                      <th className="px-3 py-2 font-medium">IP</th>
                      <th className="px-3 py-2 font-medium">Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyRows.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                          {fmtDate(h.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">
                            {h.fullName}
                          </p>
                          <p className="text-xs text-slate-500">{h.email}</p>
                        </td>
                        <td className="px-3 py-2">
                          {h.success ? (
                            <span className="text-xs font-semibold uppercase text-emerald-700">
                              OK
                            </span>
                          ) : (
                            <span className="text-xs font-semibold uppercase text-rose-700">
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {h.ipAddress ?? '—'}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-3 py-2 text-xs text-slate-500"
                          title={h.userAgent ?? undefined}
                        >
                          {h.userAgent ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
