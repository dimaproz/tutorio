import { NextResponse, type NextRequest } from 'next/server';
import { authSessionSchema, loginSchema } from '@tutorio/validation';
import { setAuthCookies } from '@/lib/auth/cookies';
import {
  callAuthApi,
  errorResponse,
  forbiddenResponse,
  originAllowed,
  toSafeSession,
} from '@/lib/auth/gateway';

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) {
    return forbiddenResponse();
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { statusCode: 400, code: 'VALIDATION', message: 'Invalid credentials payload' },
      { status: 400 },
    );
  }

  const { status, data } = await callAuthApi('/auth/login', parsed.data);
  const session = authSessionSchema.safeParse(data);
  if (status !== 200 || !session.success) {
    return errorResponse(status === 200 ? 502 : status, data);
  }

  const response = NextResponse.json(toSafeSession(session.data), { status: 200 });
  setAuthCookies(response, session.data.tokens);
  return response;
}
