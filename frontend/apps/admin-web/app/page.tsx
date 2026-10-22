import { defaultPortal } from '@pssms/permissions';
import type { SessionUser } from '@pssms/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Land every role on its own first portal instead of hard-coding /superadmin.
 * A guard or payroll officer otherwise hits "Access denied" right after login.
 */
export default async function HomePage() {
  const raw = (await cookies()).get('pssms_admin_user')?.value;
  let user: SessionUser | null = null;
  if (raw) {
    try {
      user = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    } catch {
      user = null;
    }
  }
  redirect(defaultPortal(user));
}
