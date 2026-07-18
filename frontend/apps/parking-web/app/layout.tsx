import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HIGHLINK Parking Portal',
  description: 'PSSMS parking permits, entries, ANPR results, and blacklist',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
