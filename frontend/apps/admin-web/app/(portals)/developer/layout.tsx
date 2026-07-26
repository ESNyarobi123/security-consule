'use client';

import type { ReactNode } from 'react';

/** Shared wrapper — tabs live in each page via DeveloperShell for clarity. */
export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return children;
}
