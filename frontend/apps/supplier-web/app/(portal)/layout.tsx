'use client';

import {
  clearSupplierSession,
  getSupplierSessionUser,
} from '@pssms/auth';
import { supplierNav } from '@pssms/permissions';
import { SupplierShell } from '@pssms/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getSupplierSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setUserName(user.fullName);
    setReady(true);
  }, [router]);

  function logout() {
    clearSupplierSession();
    router.push('/login');
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f6fa] text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <SupplierShell
      userName={userName}
      nav={supplierNav()}
      pathname={pathname}
      onLogout={logout}
    >
      {children}
    </SupplierShell>
  );
}
