'use client';

import { getSupplierMe } from '@pssms/api-client';
import {
  clearSupplierSession,
  getSupplierSessionUser,
} from '@pssms/auth';
import { supplierNav } from '@pssms/permissions';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SupplierPortalShell } from '../_components/SupplierPortalShell';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [supplierName, setSupplierName] = useState<string | undefined>();
  const [supplierCode, setSupplierCode] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const user = getSupplierSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setUserName(user.fullName);
    setReady(true);
    void getSupplierMe()
      .then((me) => {
        setSupplierName(me.name);
        setSupplierCode(me.code);
        setBootError(null);
      })
      .catch((err) => {
        setBootError(
          err instanceof Error
            ? err.message
            : 'Could not load your supplier profile',
        );
      });
  }, [router]);

  function logout() {
    clearSupplierSession();
    router.push('/login');
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] text-[#605e5c]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="mt-3 text-sm">Opening supplier portal…</p>
        </div>
      </div>
    );
  }

  return (
    <SupplierPortalShell
      userName={userName}
      supplierName={supplierName}
      supplierCode={supplierCode}
      nav={supplierNav()}
      pathname={pathname}
      onLogout={logout}
    >
      {bootError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {bootError}
        </div>
      ) : null}
      {children}
    </SupplierPortalShell>
  );
}
