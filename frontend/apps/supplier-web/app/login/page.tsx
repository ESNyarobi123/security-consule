'use client';

import { registerSupplier, supplierLogin } from '@pssms/api-client';
import { setSupplierSession } from '@pssms/auth';
import { Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const fieldCls =
  'mt-1.5 w-full rounded-xl border border-[#c8c6c4] bg-white px-3.5 py-2.5 text-[#1b1a19] outline-none transition focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('portal@uniforms.co.tz');
  const [password, setPassword] = useState('ChangeMe123!');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [tin, setTin] = useState('');
  const [vrn, setVrn] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('GOODS');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const msg = new URLSearchParams(window.location.search).get('error');
    if (msg) setError(msg);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await supplierLogin(email, password);
      setSupplierSession(result.tokens.accessToken, result.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await registerSupplier({
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        tin: tin.trim() || undefined,
        vrn: vrn.trim() || undefined,
        address: address.trim() || undefined,
        category,
      });
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#071526] via-[#0b1f3a] to-[#9a3412]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #fdba74 0, transparent 35%), radial-gradient(circle at 80% 20%, #38bdf8 0, transparent 30%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <div className="max-w-lg text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100 backdrop-blur">
            <Package className="h-3.5 w-3.5" />
            Portal 35.17
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            HIGHLINK
            <span className="block text-amber-200">Supplier Access</span>
          </h1>
          <p className="mt-4 text-base text-slate-200/90">
            Register your company, upload documents, then sign in. You only see
            your own profile, issued purchase orders, quotes, invoices, delivery
            notes, payment status, and procurement messages.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>• Self-register — procurement approves before trading</li>
            <li>• Upload licence, TIN and VRN on your profile</li>
            <li>• Receive issued POs; submit quotes, invoices and DNs</li>
            <li>• Track payment status and message procurement</li>
          </ul>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#f3f2f1] p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`rounded-lg px-3 py-2 ${
                mode === 'signin' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-[#605e5c]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setNotice(null);
                setEmail('');
                setPassword('');
              }}
              className={`rounded-lg px-3 py-2 ${
                mode === 'register' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-[#605e5c]'
              }`}
            >
              Register
            </button>
          </div>

          {mode === 'signin' ? (
            <form onSubmit={onSubmit}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ea580c]">
                Sign in
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[#1b1a19]">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-[#605e5c]">
                Use your supplier portal credentials.
              </p>

              <label className="mt-6 block text-sm font-medium text-[#323130]">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldCls}
                  required
                  autoComplete="username"
                />
              </label>
              <label className="mt-4 block text-sm font-medium text-[#323130]">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldCls}
                  required
                  autoComplete="current-password"
                />
              </label>

              {notice ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#ea580c] to-[#c2410c] px-4 py-3 font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Continue to portal'}
              </button>
            </form>
          ) : (
            <form onSubmit={onRegister} className="max-h-[70vh] overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ea580c]">
                Register
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[#1b1a19]">
                Supplier company
              </h2>
              <p className="mt-1 text-sm text-[#605e5c]">
                Pending until HIGHLINK procurement approves you.
              </p>

              <label className="mt-5 block text-sm font-medium text-[#323130]">
                Company name
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={fieldCls}
                  required
                  minLength={2}
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-[#323130]">
                Contact person
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className={fieldCls}
                  required
                  minLength={2}
                />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#323130]">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldCls}
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  Phone
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={fieldCls}
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#323130]">
                  TIN
                  <input
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    className={fieldCls}
                  />
                </label>
                <label className="block text-sm font-medium text-[#323130]">
                  VRN
                  <input
                    value={vrn}
                    onChange={(e) => setVrn(e.target.value)}
                    className={fieldCls}
                  />
                </label>
              </div>
              <label className="mt-3 block text-sm font-medium text-[#323130]">
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={fieldCls}
                >
                  <option value="GOODS">Goods</option>
                  <option value="SERVICES">Services</option>
                  <option value="BOTH">Goods and services</option>
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium text-[#323130]">
                Address
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={fieldCls}
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-[#323130]">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldCls}
                  required
                  minLength={8}
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-[#323130]">
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldCls}
                  required
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
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#ea580c] to-[#c2410c] px-4 py-3 font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
              >
                {loading ? 'Submitting…' : 'Submit registration'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
