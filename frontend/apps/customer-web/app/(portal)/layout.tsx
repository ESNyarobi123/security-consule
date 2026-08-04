'use client';

import { getCustomerMe } from '@pssms/api-client';
import {
  clearCustomerSession,
  getCustomerSessionUser,
} from '@pssms/auth';
import { customerNav, isCustomerEmployeeOnly } from '@pssms/permissions';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CustomerPortalShell } from '../_components/CustomerPortalShell';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sessionUser = useMemo(() => getCustomerSessionUser(), []);
  const [userName, setUserName] = useState('');
  const [customerName, setCustomerName] = useState<string | undefined>();
  const [customerCode, setCustomerCode] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const user = getCustomerSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.customerId) {
      clearCustomerSession();
      router.replace(
        `/login?error=${encodeURIComponent(
          'This account is not linked to a customer organisation.',
        )}`,
      );
      return;
    }
    if (user.mustChangePassword) {
      router.replace('/change-password');
      return;
    }
    setUserName(user.fullName);
    setReady(true);
    void getCustomerMe()
      .then((me) => {
        setCustomerName(me.name);
        setCustomerCode(me.code);
        setBootError(null);
      })
      .catch((err) => {
        // Employee shell can still open; org label is optional.
        if (isCustomerEmployeeOnly(user)) {
          setBootError(null);
          return;
        }
        setBootError(
          err instanceof Error
            ? err.message
            : 'Could not load your organisation profile',
        );
      });
  }, [router]);

  useEffect(() => {
    if (!ready || !sessionUser || !pathname) return;
    const nav = customerNav(sessionUser);
    const allowed =
      nav.some(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) || pathname === '/change-password';
    if (!allowed) {
      const fallback = isCustomerEmployeeOnly(sessionUser)
        ? '/my-access'
        : '/dashboard';
      if (pathname !== fallback) router.replace(fallback);
    }
  }, [ready, sessionUser, pathname, router]);

  function logout() {
    clearCustomerSession();
    router.push('/login');
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] text-[#605e5c]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <p className="mt-3 text-sm">Opening your portal…</p>
        </div>
      </div>
    );
  }

  return (
    <CustomerPortalShell
      userName={userName}
      customerName={customerName}
      customerCode={customerCode}
      nav={customerNav(sessionUser)}
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
    </CustomerPortalShell>
  );
}
