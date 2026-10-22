'use client';

import { getSessionUser } from '@pssms/auth';
import { can } from '@pssms/permissions';
import { useMemo } from 'react';
import { MyPayroll } from './_components/MyPayroll';
import { PayrollConsoleOverview } from './_components/PayrollConsoleOverview';

/**
 * Portal 35.16 entry.
 *
 * - `payroll.manage` → full company/customer payroll console.
 * - every other signed-in employee → their own payslips only (`/payroll/me/*`).
 *
 * The self view needs no permission grant (`ess.access` is no longer involved).
 * The two audiences never share data on screen: the self view has no cycle
 * lists, no customer options, and no other employee's snapshot. Managers can
 * open their own slip from the "My payslips" tab.
 */
export default function PayrollPage() {
  const user = useMemo(() => getSessionUser(), []);
  const canManage = can(user, 'payroll.manage');
  return canManage ? <PayrollConsoleOverview /> : <MyPayroll />;
}
