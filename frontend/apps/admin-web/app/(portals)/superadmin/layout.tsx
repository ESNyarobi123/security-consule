import type { ReactNode } from 'react';
import { SuperAdminShell } from './_components/SuperAdminShell';

export default function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SuperAdminShell>{children}</SuperAdminShell>;
}
