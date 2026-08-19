'use client';

import {
  listEmployees,
  listStaffJobApplications,
  updateJobApplicationOnboarding,
  type Employee,
  type StaffJobApplication,
} from '@pssms/api-client';
import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { btnSecondary } from '@pssms/ui';
import { ClipboardList, RefreshCw, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmployeeRoster } from '../_components/EmployeeRoster';
import { HrShell } from '../_components/HrShell';
import { PanelEmpty, formatDate } from '../_components/shared';

const ONBOARDING_DAYS = 90;

function isRecentHire(employee: Employee, days = ONBOARDING_DAYS): boolean {
  if (!employee.hireDate) return false;
  const hired = new Date(employee.hireDate);
  if (Number.isNaN(hired.getTime())) return false;
  const status = employee.status.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (status === 'TERMINATED') return false;
  return hired.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export default function HrOnboardingPage() {
  const session = useMemo(() => getSessionUser(), []);
  const canRecruit = can(session, 'recruitment.manage');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [hires, setHires] = useState<StaffJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busyStep, setBusyStep] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, apps] = await Promise.all([
        listEmployees(),
        canRecruit
          ? listStaffJobApplications({ status: 'HIRED' }).catch(
              () => [] as StaffJobApplication[],
            )
          : Promise.resolve([] as StaffJobApplication[]),
      ]);
      setEmployees(emps);
      setHires(apps);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [canRecruit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recent = useMemo(
    () => employees.filter((e) => isRecentHire(e)),
    [employees],
  );

  async function toggleStep(app: StaffJobApplication, code: string, done: boolean) {
    setBusyStep(`${app.id}:${code}`);
    setError(null);
    try {
      const updated = await updateJobApplicationOnboarding(app.id, {
        stepCode: code,
        done,
      });
      setHires((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <HrShell
      title="Onboarding"
      description="Hired applications with a live onboarding checklist (contract, medical, police, kit/training or workstation, ESS, induction). Design medical/police engines and GuardProfile convert remain deferred."
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

      <p className="mb-4 rounded border border-[#cfe4f7] bg-[#f3f9fd] px-3 py-2 text-xs text-[#323130]">
        Applicants see the same steps (done/pending only) on recruitment-web
        /status after hire. Employment→CEO matrix UX is not on this page.
      </p>

      <section>
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1b1a19]">
              Hired in the last {ONBOARDING_DAYS} days
            </h2>
            <p className="text-[11px] text-[#605e5c]">
              {loading ? 'Loading…' : `${recent.length} employee records`}
            </p>
          </div>
          <Link
            href="/hr/employees"
            className="text-[11px] font-medium text-[#0067b8] hover:underline"
          >
            Open register
          </Link>
        </div>
        <EmployeeRoster
          rows={recent}
          loading={loading}
          compact
          empty={
            <PanelEmpty
              icon={<UserPlus className="h-4 w-4" />}
              title="No recent hires"
              description="New employees with a hire date in the last 90 days appear here."
            />
          }
        />
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#1b1a19]">
              Hired applications
            </h2>
            <p className="text-[11px] text-[#605e5c]">
              {canRecruit
                ? loading
                  ? 'Loading…'
                  : `${hires.length} HIRED applications`
                : 'Requires recruitment.manage to list the inbox'}
            </p>
          </div>
          {canRecruit ? (
            <Link
              href="/hr/applications"
              className="text-[11px] font-medium text-[#0067b8] hover:underline"
            >
              Applications inbox
            </Link>
          ) : null}
        </div>
        {!canRecruit ? (
          <p className="rounded-xl border border-[#e1dfdd] bg-white px-4 py-6 text-sm text-[#605e5c]">
            Department Heads see the employee register. Recruitment Officers
            with recruitment.manage hire from Applications.
          </p>
        ) : hires.length === 0 && !loading ? (
          <PanelEmpty
            icon={<ClipboardList className="h-4 w-4" />}
            title="No hired applications"
            description="Advance an offer and Hire on the Applications tab."
          />
        ) : (
          <ul className="divide-y divide-[#f3f2f1] overflow-hidden rounded-xl border border-[#e1dfdd] bg-white shadow-sm">
            {hires.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#1b1a19]">
                      {a.applicantName}
                    </p>
                    <p className="text-[11px] text-[#605e5c]">
                      {a.referenceNumber}
                      {a.postingTitle ? ` · ${a.postingTitle}` : ''}
                      {a.applicantTrack ? ` · ${a.applicantTrack}` : ''}
                    </p>
                  </div>
                  <p className="text-[11px] tabular-nums text-[#605e5c]">
                    {formatDate(a.createdAt)}
                  </p>
                </div>
                {a.onboardingSteps?.length ? (
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {a.onboardingSteps.map((step) => (
                      <li key={step.code}>
                        <label className="flex items-center gap-2 text-xs text-[#323130]">
                          <input
                            type="checkbox"
                            checked={step.done}
                            disabled={busyStep === `${a.id}:${step.code}`}
                            onChange={() =>
                              void toggleStep(a, step.code, !step.done)
                            }
                          />
                          {step.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-[#8a8886]">
                    Checklist starts when Hire is used from Applications.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </HrShell>
  );
}
