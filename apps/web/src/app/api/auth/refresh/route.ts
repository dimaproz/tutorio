import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '@/lib/auth/cookies';
import {
  forbiddenResponse,
  originAllowed,
  rotateRefreshToken,
  toSafeSession,
} from '@/lib/auth/gateway';

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return forbiddenResponse();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const session = refreshToken ? await rotateRefreshToken(refreshToken) : null;

  if (!session) {
    const response = NextResponse.json(
      { statusCode: 401, code: 'SESSION_EXPIRED', message: 'Session has expired' },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json(toSafeSession(session), { status: 200 });
  setAuthCookies(response, session.tokens);
  return response;
}
