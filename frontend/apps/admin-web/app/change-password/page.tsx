'use client';

import { changePassword, getAuthPasswordPolicy } from '@pssms/api-client';
import {
  clearSession,
  getSessionUser,
  getToken,
  setSession,
} from '@pssms/auth';
import { defaultPortal } from '@pssms/permissions';
import { KeyRound, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [policyHint, setPolicyHint] = useState(
    'At least 10 characters with upper, lower, digit, and symbol.',
  );

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.mustChangePassword) {
      router.replace(defaultPortal(user));
      return;
    }
    setEmail(user.email);
    const token = getToken();
    if (token) {
      void getAuthPasswordPolicy(token)
        .then((p) => setPolicyHint(p.summary))
        .catch(() => undefined);
    }
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('New password and confirmation do not match');
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    try {
      const result = await changePassword(
        { currentPassword, newPassword },
        token,
      );
      setSession(
        result.tokens.accessToken,
        result.user,
        result.tokens.refreshToken,
      );
      router.replace(defaultPortal(result.user));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-[#071526] via-[#0b1f3a] to-[#0d9488]" />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0078d4]/20 bg-[#eff6fc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0078d4]">
          <Shield className="h-3.5 w-3.5" />
          Security
        </div>
        <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-[#1b1a19]">
          <KeyRound className="h-6 w-6 text-[#0078d4]" />
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-[#605e5c]">
          Your temporary password for{' '}
          <span className="font-medium text-[#323130]">{email || '…'}</span>{' '}
          must be replaced before you can use the console.
        </p>

        <label className="mt-6 block text-sm font-medium text-[#323130]">
          Current (temporary) password
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#c8c6c4] px-3.5 py-2.5 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-[#323130]">
          New password
          <input
            type="password"
            required
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#c8c6c4] px-3.5 py-2.5 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
          />
        </label>
        <p className="mt-1 text-[11px] text-[#8a8886]">{policyHint}</p>
        <label className="mt-4 block text-sm font-medium text-[#323130]">
          Confirm new password
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#c8c6c4] px-3.5 py-2.5 outline-none focus:border-[#0078d4] focus:ring-2 focus:ring-[#0078d4]/25"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#0078d4] to-teal-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save password & continue'}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 w-full text-sm font-semibold text-[#605e5c] hover:text-[#0078d4]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
