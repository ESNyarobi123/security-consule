import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/auth/callback'];

function mustChangePassword(request: NextRequest): boolean {
  const raw = request.cookies.get('pssms_admin_user')?.value;
  if (!raw) return false;
  try {
    const user = JSON.parse(decodeURIComponent(raw)) as {
      mustChangePassword?: boolean;
    };
    return user.mustChangePassword === true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pssms_admin_token');
  const { pathname } = request.nextUrl;
  const forcePw = token != null && mustChangePassword(request);

  if (forcePw && pathname !== '/change-password' && pathname !== '/login') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  if (pathname === '/login' && token) {
    if (forcePw) {
      return NextResponse.redirect(new URL('/change-password', request.url));
    }
    return NextResponse.redirect(new URL('/superadmin', request.url));
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
