import type { NextResponse } from 'next/server';
import type { AuthTokens } from '@tutorio/validation';

export const ACCESS_COOKIE = 'tutorio_access';
export const REFRESH_COOKIE = 'tutorio_refresh';

// Lifetimes mirror the API token TTLs (JWT_ACCESS_TTL / JWT_REFRESH_TTL).
const ACCESS_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  } as const;
}

export function setAuthCookies(response: NextResponse, tokens: AuthTokens): void {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, '', { ...baseOptions(), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...baseOptions(), maxAge: 0 });
}
