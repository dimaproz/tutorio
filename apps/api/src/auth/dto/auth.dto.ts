import { createZodDto } from 'nestjs-zod';
import {
  authMeSchema,
  authSessionSchema,
  currentWorkspaceSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '@tutorio/validation';
import { z } from 'zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class RefreshDto extends createZodDto(refreshSchema) {}
export class LogoutDto extends createZodDto(logoutSchema) {}

// Response DTOs — serialized through ZodSerializerInterceptor, so anything
// not declared here (hashes, timestamps, internals) is stripped.
export class AuthSessionDto extends createZodDto(authSessionSchema) {}
export class AuthMeDto extends createZodDto(authMeSchema) {}
export class CurrentWorkspaceDto extends createZodDto(currentWorkspaceSchema) {}

const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
});

export class ApiErrorDto extends createZodDto(apiErrorSchema) {}
