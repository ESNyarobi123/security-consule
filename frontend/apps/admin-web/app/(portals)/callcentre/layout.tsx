import type { ReactNode } from 'react';
import { CallCentreShell } from './_components/CallCentreShell';

export default function CallCentreLayout({ children }: { children: ReactNode }) {
  return <CallCentreShell>{children}</CallCentreShell>;
}
