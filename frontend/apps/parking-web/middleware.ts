import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const OPS_PUBLIC = ['/login'];
const OWNER_LOGIN = '/owner/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const parkingToken = request.cookies.get('pssms_parking_token');
  const ownerToken = request.cookies.get('pssms_owner_token');

  const isOwnerRoute =
    pathname === OWNER_LOGIN ||
    pathname === '/owner' ||
    pathname.startsWith('/owner/');

  if (isOwnerRoute) {
    if (pathname === OWNER_LOGIN && ownerToken) {
      return NextResponse.redirect(new URL('/owner', request.url));
    }
    if (pathname !== OWNER_LOGIN && !ownerToken) {
      return NextResponse.redirect(new URL(OWNER_LOGIN, request.url));
    }
    return NextResponse.next();
  }

  if (OPS_PUBLIC.includes(pathname) && parkingToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (!OPS_PUBLIC.includes(pathname) && !parkingToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
