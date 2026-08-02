import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const display = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HIGHLINK Parking Portal',
  description: 'PSSMS parking permits, entries, ANPR results, and blacklist',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
