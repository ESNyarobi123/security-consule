import type { ReactNode } from 'react';
import { ProcurementShell } from './_components/ProcurementShell';

export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return <ProcurementShell>{children}</ProcurementShell>;
}
