import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

/** Preline UI default sans — Inter */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

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
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
