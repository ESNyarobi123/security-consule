'use client';

import type { ReactNode } from 'react';

/** Root wrapper for PSSMS portals (HeroUI v3 needs no global provider). */
export function AppProviders({ children }: { children: ReactNode }) {
  return children;
}
