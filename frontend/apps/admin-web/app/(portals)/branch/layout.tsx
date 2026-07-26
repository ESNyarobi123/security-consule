'use client';

import type { ReactNode } from 'react';

/** Shared wrapper — tabs live in each page via BranchShell. */
export default function BranchLayout({ children }: { children: ReactNode }) {
  return children;
}
