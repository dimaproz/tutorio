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

// The client's address as seen by the hosting edge. Vercel overwrites
// x-forwarded-for with the real client address, so its first entry is safe
// to forward; x-real-ip is the fallback for other proxies.
export function clientAddress(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || undefined;
}

// Every server-to-server call carries the client's address and, when
// configured, the shared secret that lets the API trust it. Without these
// the API would rate-limit the whole product as one client (the gateway).
export function upstreamHeaders(request?: NextRequest): Headers {
  const headers = new Headers();
  const address = request ? clientAddress(request) : undefined;
  if (address) {
    headers.set('x-forwarded-for', address);
  }
  const secret = process.env.GATEWAY_SHARED_SECRET;
  if (secret) {
    headers.set('x-gateway-secret', secret);
  }
  return headers;
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
  request?: NextRequest,
): Promise<{ status: number; data: unknown }> {
  const headers = upstreamHeaders(request);
  headers.set('content-type', 'application/json');
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}

// Rotates the refresh token server-to-server. Returns the full session on
// success, null when the session is gone (invalid, expired, revoked).
export async function rotateRefreshToken(
  refreshToken: string,
  request?: NextRequest,
): Promise<AuthSession | null> {
  const { status, data } = await callAuthApi('/auth/refresh', { refreshToken }, request);
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
