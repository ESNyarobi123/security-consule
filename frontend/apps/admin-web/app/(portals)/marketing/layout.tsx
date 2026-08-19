import type { ReactNode } from 'react';
import { MarketingShell } from './_components/MarketingShell';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
