'use client';

import type { ReactNode } from 'react';

/** Shared wrapper — tabs live in each page via EssShell. */
export default function EssLayout({ children }: { children: ReactNode }) {
  return children;
}
