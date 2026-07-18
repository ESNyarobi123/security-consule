import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HIGHLINK Customer Portal',
  description: 'PSSMS customer contracts, invoices, visitors, access & parking',
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
