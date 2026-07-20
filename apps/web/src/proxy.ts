import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';

// Optimistic redirects based on cookie presence only. This is UX sugar, not
// authorization — the real session check happens against /api/auth/me inside
// the protected shell, and the API enforces authorization on every request.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(REFRESH_COOKIE);

  if (pathname.startsWith('/app') && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if ((pathname === '/login' || pathname === '/register') && hasSessionCookie) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/login', '/register'],
};
