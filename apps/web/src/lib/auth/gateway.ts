import { NextResponse, type NextRequest } from 'next/server';
import { authSessionSchema, type AuthSession } from '@tutorio/validation';

// Server-only base URL of the Tutorio API; the catch-all proxy can never
// reach any other host.
const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

// CSRF defense-in-depth on top of SameSite=Lax: when a browser sends an
// Origin header on a state-changing request, it must match our own host.
export function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { statusCode: 403, code: 'FORBIDDEN', message: 'Cross-origin request rejected' },
    { status: 403 },
  );
}

export async function callAuthApi(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: unknown }> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}

// Rotates the refresh token server-to-server. Returns the full session on
// success, null when the session is gone (invalid, expired, revoked).
export async function rotateRefreshToken(refreshToken: string): Promise<AuthSession | null> {
  const { status, data } = await callAuthApi('/auth/refresh', { refreshToken });
  if (status !== 200) {
    return null;
  }
  const parsed = authSessionSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// Strips tokens: only safe user/workspace data ever reaches the browser.
export function toSafeSession(session: AuthSession) {
  return { user: session.user, workspace: session.workspace, role: session.role };
}

// Forwards an upstream auth error, normalizing unparseable bodies.
export function errorResponse(status: number, data: unknown): NextResponse {
  if (data && typeof data === 'object' && 'code' in data) {
    return NextResponse.json(data, { status });
  }
  return NextResponse.json(
    { statusCode: status, code: 'UNEXPECTED', message: 'Upstream request failed' },
    { status },
  );
}
