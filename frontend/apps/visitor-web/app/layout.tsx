import type { Metadata } from 'next';
import { Outfit, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const display = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HIGHLINK · Visitor Appointment',
  description:
    'Pre-register your visit. Reference now — gate code after host approval.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
