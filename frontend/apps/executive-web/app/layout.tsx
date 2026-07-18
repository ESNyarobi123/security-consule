import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HIGHLINK Executive Dashboard',
  description: 'PSSMS executive analytics — KPIs and operational insight',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
