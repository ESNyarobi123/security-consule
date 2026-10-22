'use client';

import { MyPayroll } from '../_components/MyPayroll';

/**
 * Portal 35.16 — "My payslips" tab.
 *
 * Available to every signed-in employee, including payroll managers (who also
 * see the company/customer console on `/payroll`). The server only ever
 * returns the caller's own snapshots.
 */
export default function MyPayrollPage() {
  return <MyPayroll />;
}
