import { defaultPortal } from '@pssms/permissions';
import type { SessionUser } from '@pssms/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/auth/callback'];

function sessionUser(request: NextRequest): SessionUser | null {
  const raw = request.cookies.get('pssms_admin_user')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}

function mustChangePassword(request: NextRequest): boolean {
  const user = sessionUser(request) as (SessionUser & { mustChangePassword?: boolean }) | null;
  return user?.mustChangePassword === true;
}

function firstPortal(request: NextRequest): string {
  return defaultPortal(sessionUser(request));
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pssms_admin_token');
  const { pathname } = request.nextUrl;
  const forcePw = token != null && mustChangePassword(request);

  if (forcePw && pathname !== '/change-password' && pathname !== '/login') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  if ((pathname === '/login' || pathname === '/') && token) {
    if (forcePw) {
      return NextResponse.redirect(new URL('/change-password', request.url));
    }
    const portal = firstPortal(request);
    // No known portal: let the request through instead of looping on /login.
    if (portal !== '/login') {
      return NextResponse.redirect(new URL(portal, request.url));
    }
  }
  if (pathname === '/change-password' && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (!PUBLIC.includes(pathname) && pathname !== '/change-password' && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
