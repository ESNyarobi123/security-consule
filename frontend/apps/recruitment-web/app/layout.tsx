import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'HIGHLINK Careers',
  description: 'Browse open roles and apply at HIGHLINK Security',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <nav className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-sm font-semibold text-slate-900">
                HIGHLINK Careers
              </Link>
              <Link
                href="/status"
                className="text-sm text-slate-600 hover:text-sky-700"
              >
                Check application status
              </Link>
            </div>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
