'use client';

import { parkingLogin } from '@pssms/api-client';
import { setParkingSession } from '@pssms/auth';
import {
  Camera,
  CarFront,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ParkingCircle,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

function canAccessParkingPortal(user: {
  roles: string[];
  permissions: string[];
}): boolean {
  if (user.roles.includes('PARKING_OFFICER')) return true;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  if (user.permissions.includes('parking.manage')) return true;
  return false;
}

const CAPABILITIES = [
  {
    icon: KeyRound,
    label: 'Permits',
    detail: 'Issue, approve, and revoke site access',
  },
  {
    icon: CarFront,
    label: 'Gate entries',
    detail: 'Log vehicles in and out at the barrier',
  },
  {
    icon: Camera,
    label: 'ANPR decide',
    detail: 'Allow or deny from plate metadata',
  },
  {
    icon: ShieldAlert,
    label: 'Enforcement',
    detail: 'Violations and blacklist for gate denial',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('parking1@highlink.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await parkingLogin(email, password);
      if (!canAccessParkingPortal(result.user)) {
        setError(
          'This account is not authorized for the parking portal (need PARKING_OFFICER, SUPER_ADMIN, or parking.manage).',
        );
        return;
      }
      setParkingSession(result.tokens.accessToken, result.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#06111f] via-[#0f2744] to-[#0f766e]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 40% at 15% 20%, rgba(45,212,191,0.35) 0%, transparent 55%), radial-gradient(ellipse 40% 35% at 85% 15%, rgba(56,189,248,0.25) 0%, transparent 50%), radial-gradient(ellipse 45% 40% at 70% 85%, rgba(37,99,235,0.2) 0%, transparent 55%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <div className="max-w-lg text-white login-fade-up">
          <div className="inline-flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-sky-600 shadow-lg shadow-teal-900/40">
              <ParkingCircle className="h-5 w-5 text-white" strokeWidth={2.25} />
            </span>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">
                HIGHLINK
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-200/90">
                Parking Portal · 35.12
              </p>
            </div>
          </div>

          <h1 className="font-display mt-7 text-4xl font-bold tracking-tight sm:text-5xl">
            Gate control
            <span className="mt-1 block bg-gradient-to-r from-teal-200 to-sky-300 bg-clip-text text-transparent">
              for site ops
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
            Permits, barrier entries, ANPR decisions, violations, and plate
            blacklist — one ops console. Plate metadata only; video stays on NVR.
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, label, detail }) => (
              <li
                key={label}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur-sm"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-400/15 text-teal-200">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-400">
                    {detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          className="login-fade-up login-fade-up-delay w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d9488]">
            Officer sign-in
          </p>
          <h2 className="font-display mt-1.5 text-2xl font-bold text-slate-900">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use your HIGHLINK parking ops credentials.
          </p>

          <label className="mt-6 block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/25"
              required
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Password
            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/25"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0f2744] to-[#0d9488] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Enter control room'
            )}
          </button>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
            Authorized parking officers only · ANPR = plate metadata · Video on
            NVR
          </p>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Vehicle owner?{' '}
            <Link href="/owner/login" className="text-teal-700 hover:underline">
              Owner sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
