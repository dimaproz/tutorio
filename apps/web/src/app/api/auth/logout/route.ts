import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookies, REFRESH_COOKIE } from '@/lib/auth/cookies';
import { callAuthApi, forbiddenResponse, originAllowed } from '@/lib/auth/gateway';

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return forbiddenResponse();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    // Best effort — cookies are cleared even if the API is unreachable.
    await callAuthApi('/auth/logout', { refreshToken }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  clearAuthCookies(response);
  return response;
}
