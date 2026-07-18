import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pssms_supplier_token');
  const { pathname } = request.nextUrl;

  if (PUBLIC.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (!PUBLIC.includes(pathname) && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
