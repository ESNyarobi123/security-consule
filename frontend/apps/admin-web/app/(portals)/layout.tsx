'use client';

import { clearSession, getSessionUser } from '@pssms/auth';
import {
  can,
  navForUser,
  permissionForPath,
} from '@pssms/permissions';
import { AdminShell } from '@pssms/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PortalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const [denied, setDenied] = useState(false);
  const [nav, setNav] = useState<ReturnType<typeof navForUser>>([]);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setUserName(user.fullName);
    setUserEmail(user.email);
    setUserRole(
      (user.roles[0] ?? 'USER').replace(/_/g, ' ').toLowerCase(),
    );
    setNav(navForUser(user));
    const required = permissionForPath(pathname);
    if (required && !can(user, required)) {
      setDenied(true);
    } else {
      setDenied(false);
    }
  }, [pathname, router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (denied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your role does not have permission for this portal.
          </p>
          <button
            type="button"
            onClick={() => router.push('/superadmin')}
            className="mt-4 rounded-md bg-[#0078d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#106ebe]"
          >
            Go to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      userName={userName}
      userEmail={userEmail}
      userRole={userRole}
      nav={nav}
      pathname={pathname}
      onLogout={logout}
    >
      {children}
    </AdminShell>
  );
}
