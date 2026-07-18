import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HIGHLINK Supplier Portal',
  description: 'PSSMS supplier profile and purchase orders',
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
