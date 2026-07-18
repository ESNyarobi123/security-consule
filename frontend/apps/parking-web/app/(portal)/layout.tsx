'use client';

import {
  clearParkingSession,
  getParkingSessionUser,
} from '@pssms/auth';
import { parkingNav } from '@pssms/permissions';
import { ParkingShell } from '@pssms/ui';
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
    const user = getParkingSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setUserName(user.fullName);
    setReady(true);
  }, [router]);

  function logout() {
    clearParkingSession();
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
    <ParkingShell
      userName={userName}
      nav={parkingNav()}
      pathname={pathname}
      onLogout={logout}
    >
      {children}
    </ParkingShell>
  );
}
