import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/auth/callback'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pssms_admin_token');
  const { pathname } = request.nextUrl;

  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/superadmin', request.url));
  }
  if (!PUBLIC.includes(pathname) && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
