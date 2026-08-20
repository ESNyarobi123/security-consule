import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HIGHLINK Customer Portal',
  description:
    'Contracts, guards, visitors, parking, invoices — your organisation only',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} light`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} bg-background text-foreground font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
