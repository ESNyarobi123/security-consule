'use client';

import type { ReactNode } from 'react';

/** Shared wrapper — tabs live in each page via ComplianceShell. */
export default function ComplianceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
