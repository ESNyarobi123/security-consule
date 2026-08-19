import type { ReactNode } from 'react';
import { FinanceShell } from './_components/FinanceShell';

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <FinanceShell>{children}</FinanceShell>;
}
