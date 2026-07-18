'use client';

import {
  clearCustomerSession,
  getCustomerSessionUser,
} from '@pssms/auth';
import { customerNav } from '@pssms/permissions';
import { CustomerShell } from '@pssms/ui';
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
    const user = getCustomerSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setUserName(user.fullName);
    setReady(true);
  }, [router]);

  function logout() {
    clearCustomerSession();
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
    <CustomerShell
      userName={userName}
      nav={customerNav()}
      pathname={pathname}
      onLogout={logout}
    >
      {children}
    </CustomerShell>
  );
}
