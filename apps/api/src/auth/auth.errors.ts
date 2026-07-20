import { HttpException, HttpStatus } from '@nestjs/common';
import type { AuthErrorCode } from '@tutorio/validation';

// Stable machine-readable error contract shared with the web gateway.
export class AuthApiException extends HttpException {
  constructor(code: AuthErrorCode, message: string, status: HttpStatus) {
    super({ statusCode: status, code, message }, status);
  }
}

export const emailTaken = () =>
  new AuthApiException(
    'EMAIL_TAKEN',
    'Email is already registered',
    HttpStatus.CONFLICT,
  );

// Same response for unknown email and wrong password — never reveal which.
export const invalidCredentials = () =>
  new AuthApiException(
    'INVALID_CREDENTIALS',
    'Invalid email or password',
    HttpStatus.UNAUTHORIZED,
  );

export const invalidRefreshToken = () =>
  new AuthApiException(
    'INVALID_REFRESH_TOKEN',
    'Refresh token is invalid',
    HttpStatus.UNAUTHORIZED,
  );

export const sessionExpired = () =>
  new AuthApiException(
    'SESSION_EXPIRED',
    'Session has expired',
    HttpStatus.UNAUTHORIZED,
  );

export const forbidden = () =>
  new AuthApiException(
    'FORBIDDEN',
    'Insufficient permissions',
    HttpStatus.FORBIDDEN,
  );
