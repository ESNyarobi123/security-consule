import type { ReactNode } from 'react';
import { PayrollShell } from './_components/PayrollShell';

export default function PayrollLayout({ children }: { children: ReactNode }) {
  return <PayrollShell>{children}</PayrollShell>;
}
