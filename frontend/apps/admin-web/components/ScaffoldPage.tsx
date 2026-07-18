'use client';

import { EmptyState, PageHeader } from '@pssms/ui';

export default function ScaffoldPage({
  title,
  description,
  phase = '8b',
}: {
  title: string;
  description: string;
  phase?: string;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        title={`Coming in Phase ${phase}`}
        description="Backend APIs are ready — full workflow UI ships next."
        action={{
          label: 'Executive dashboard',
          href: 'http://localhost:3001',
        }}
      />
    </>
  );
}
