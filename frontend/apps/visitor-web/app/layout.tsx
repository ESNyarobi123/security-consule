import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HIGHLINK Visitor Appointment',
  description: 'Pre-register a visitor appointment',
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
