import type { ReactNode } from 'react';
import { AdministrationShell } from './_components/AdministrationShell';

export default function AdministrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdministrationShell>{children}</AdministrationShell>;
}
