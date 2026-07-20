import { NextResponse, type NextRequest } from 'next/server';
import { authSessionSchema, registerSchema } from '@tutorio/validation';
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
  // Strict schema: confirmPassword or any other extra field is rejected here
  // and never reaches the API.
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { statusCode: 400, code: 'VALIDATION', message: 'Invalid registration payload' },
      { status: 400 },
    );
  }

  const { status, data } = await callAuthApi('/auth/register', parsed.data);
  const session = authSessionSchema.safeParse(data);
  if (status !== 201 || !session.success) {
    return errorResponse(status === 201 ? 502 : status, data);
  }

  const response = NextResponse.json(toSafeSession(session.data), { status: 201 });
  setAuthCookies(response, session.data.tokens);
  return response;
}
