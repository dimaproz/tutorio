import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from '@/lib/auth/cookies';
import {
  apiUrl,
  forbiddenResponse,
  originAllowed,
  rotateRefreshToken,
} from '@/lib/auth/gateway';
import type { AuthTokens } from '@tutorio/validation';

// Authenticated same-origin proxy to the Tutorio API. The upstream host is
// always the configured API_URL — path segments only select the API route.

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

function buildTargetUrl(request: NextRequest, segments: string[]): string | null {
  if (segments.length === 0 || segments.some((s) => s === '' || s === '.' || s === '..')) {
    return null;
  }
  const path = segments.map((segment) => encodeURIComponent(segment)).join('/');
  return `${apiUrl(`/${path}`)}${request.nextUrl.search}`;
}

async function callUpstream(
  request: NextRequest,
  target: string,
  accessToken: string,
  body: string | undefined,
): Promise<Response> {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${accessToken}`);
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    headers.set('accept-language', acceptLanguage);
  }
  return fetch(target, { method: request.method, headers, body, cache: 'no-store' });
}

async function toGatewayResponse(
  upstream: Response,
  freshTokens: AuthTokens | null,
): Promise<NextResponse> {
  const text = await upstream.text();
  const response = new NextResponse(text.length > 0 ? text : null, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
  if (freshTokens) {
    setAuthCookies(response, freshTokens);
  }
  return response;
}

function unauthorizedResponse(): NextResponse {
  const response = NextResponse.json(
    { statusCode: 401, code: 'SESSION_EXPIRED', message: 'Session has expired' },
    { status: 401 },
  );
  clearAuthCookies(response);
  return response;
}

async function handle(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!BODYLESS_METHODS.has(request.method) && !originAllowed(request)) {
    return forbiddenResponse();
  }

  const { path } = await ctx.params;
  const target = buildTargetUrl(request, path);
  if (!target) {
    return NextResponse.json(
      { statusCode: 404, code: 'NOT_FOUND', message: 'Unknown API path' },
      { status: 404 },
    );
  }

  const body = BODYLESS_METHODS.has(request.method) ? undefined : await request.text();
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    const upstream = await callUpstream(request, target, accessToken, body);
    if (upstream.status !== 401) {
      return toGatewayResponse(upstream, null);
    }
  }

  // Access token missing or rejected: rotate the refresh token once and retry
  // the original request exactly once — never in a loop.
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return unauthorizedResponse();
  }
  const session = await rotateRefreshToken(refreshToken);
  if (!session) {
    return unauthorizedResponse();
  }

  const retried = await callUpstream(request, target, session.tokens.accessToken, body);
  return toGatewayResponse(retried, session.tokens);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
