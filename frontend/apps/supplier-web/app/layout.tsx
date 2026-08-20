import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HIGHLINK Supplier Portal',
  description:
    'Purchase orders, company profile — your supplier account only',
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
