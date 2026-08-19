import type { ReactNode } from 'react';
import { CctvShell } from './_components/CctvShell';

export default function CctvLayout({ children }: { children: ReactNode }) {
  return <CctvShell>{children}</CctvShell>;
}
