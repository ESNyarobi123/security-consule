'use client';

import {
  createGuard,
  listEmployees,
  listGuardLinkableUsers,
  type Employee,
  type GuardLinkableUser,
} from '@pssms/api-client';
import { Modal, btnPrimary, btnSecondary, inputCls } from '@pssms/ui';
import { FormEvent, useEffect, useState } from 'react';

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
    /* plain text */
  }
  return raw;
}

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export function CreateGuardModal({ onClose, onCreated }: Props) {
  const [users, setUsers] = useState<GuardLinkableUser[]>([]);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [deploymentEligible, setDeploymentEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOpts(true);
      setError(null);
      try {
        const linkable = await listGuardLinkableUsers();
        if (cancelled) return;
        setUsers(linkable);
        try {
          const emps = await listEmployees('ACTIVE');
          if (cancelled) return;
          setEmployees(emps.filter((e) => !e.guardProfileId));
        } catch {
          if (!cancelled) setEmployees(null);
        }
      } catch (err) {
        if (!cancelled) {
          setUsers([]);
          setError(formatApiError(err));
        }
      } finally {
        if (!cancelled) setLoadingOpts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId || !employeeNumber.trim()) {
      setError('Select a user and enter a guard employee number.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createGuard({
        userId,
        employeeNumber: employeeNumber.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(employeeId ? { employeeId } : {}),
        deploymentEligible,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New guard"
      description="Link an IAM user to a GuardProfile. Optional HR Employee link when hr.manage is available."
      onClose={onClose}
      size="md"
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {error ? (
          <p className="rounded-md bg-[#fde7e9] px-3 py-2 text-sm text-[#a4262c]">
            {error}
          </p>
        ) : null}

        <label className="block text-sm font-medium text-[#323130]">
          IAM user
          <select
            className={inputCls}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={loadingOpts || submitting}
            required
          >
            <option value="">
              {loadingOpts ? 'Loading users…' : 'Select user…'}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} · {u.email}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-[#323130]">
          Guard employee number
          <input
            className={inputCls}
            value={employeeNumber}
            onChange={(e) => setEmployeeNumber(e.target.value)}
            placeholder="GRD-0100"
            disabled={submitting}
            required
          />
        </label>

        <label className="block text-sm font-medium text-[#323130]">
          Phone (optional)
          <input
            className={inputCls}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+255…"
            disabled={submitting}
          />
        </label>

        {employees !== null ? (
          <label className="block text-sm font-medium text-[#323130]">
            Link HR employee (optional)
            <select
              className={inputCls}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} · {emp.employeeNumber}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex items-center gap-2 text-sm font-medium text-[#323130]">
          <input
            type="checkbox"
            checked={deploymentEligible}
            onChange={(e) => setDeploymentEligible(e.target.checked)}
            disabled={submitting}
            className="h-4 w-4 rounded border-[#8a8886] text-[#0078d4]"
          />
          Deployment eligible
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting || loadingOpts || users.length === 0}
          >
            {submitting ? 'Creating…' : 'Create guard'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
