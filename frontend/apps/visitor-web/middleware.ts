import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CONTRACTOR_LOGIN = '/contractor/login';
const CONSULTANT_LOGIN = '/consultant/login';
const PROVIDER_LOGIN = '/provider/login';

function gateExternalLane(
  request: NextRequest,
  opts: {
    loginPath: string;
    homePath: string;
    tokenCookie: string;
    isRoute: (pathname: string) => boolean;
  },
) {
  const { pathname } = request.nextUrl;
  if (!opts.isRoute(pathname)) return null;

  const token = request.cookies.get(opts.tokenCookie);
  if (pathname === opts.loginPath && token) {
    return NextResponse.redirect(new URL(opts.homePath, request.url));
  }
  if (pathname !== opts.loginPath && !token) {
    return NextResponse.redirect(new URL(opts.loginPath, request.url));
  }
  return NextResponse.next();
}

export function middleware(request: NextRequest) {
  const contractor = gateExternalLane(request, {
    loginPath: CONTRACTOR_LOGIN,
    homePath: '/contractor',
    tokenCookie: 'pssms_contractor_token',
    isRoute: (pathname) =>
      pathname === CONTRACTOR_LOGIN ||
      pathname === '/contractor' ||
      pathname.startsWith('/contractor/'),
  });
  if (contractor) return contractor;

  const consultant = gateExternalLane(request, {
    loginPath: CONSULTANT_LOGIN,
    homePath: '/consultant',
    tokenCookie: 'pssms_consultant_token',
    isRoute: (pathname) =>
      pathname === CONSULTANT_LOGIN ||
      pathname === '/consultant' ||
      pathname.startsWith('/consultant/'),
  });
  if (consultant) return consultant;

  const provider = gateExternalLane(request, {
    loginPath: PROVIDER_LOGIN,
    homePath: '/provider',
    tokenCookie: 'pssms_provider_token',
    isRoute: (pathname) =>
      pathname === PROVIDER_LOGIN ||
      pathname === '/provider' ||
      pathname.startsWith('/provider/'),
  });
  if (provider) return provider;

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/contractor',
    '/contractor/:path*',
    '/consultant',
    '/consultant/:path*',
    '/provider',
    '/provider/:path*',
  ],
};
