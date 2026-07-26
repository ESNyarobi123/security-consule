'use client';

import type { ReactNode } from 'react';

/** Shared wrapper — tabs live in each page via HrShell. */
export default function HrLayout({ children }: { children: ReactNode }) {
  return children;
}
