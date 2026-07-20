import { z } from 'zod';

// Shared auth contracts (Stage 1). Single source of truth for web forms,
// api pipes (via nestjs-zod) and response shapes.

export const emailSchema = z.string().trim().toLowerCase().email().max(320);

// Passphrases welcome: length-only policy (OWASP), Unicode and spaces allowed,
// no composition rules. Never trim — leading/trailing spaces are significant.
export const passwordSchema = z.string().min(12).max(128);

export const userNameSchema = z.string().trim().min(1).max(120);

export const workspaceNameSchema = z.string().trim().min(2).max(80);

export const registerSchema = z
  .object({
    name: userNameSchema,
    workspaceName: workspaceNameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export type RefreshDto = z.infer<typeof refreshSchema>;

export const logoutSchema = refreshSchema;

export type LogoutDto = z.infer<typeof logoutSchema>;

// ---------------------------------------------------------------------------
// Response contracts
// ---------------------------------------------------------------------------

export const workspacePlanSchema = z.enum(['FREE', 'PRO']);
export type WorkspacePlan = z.infer<typeof workspacePlanSchema>;

export const workspaceRoleSchema = z.enum(['OWNER', 'TEACHER']);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authWorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  plan: workspacePlanSchema,
  defaultCurrency: z.string(),
  cancellationDeadlineHours: z.number().int(),
});

export type AuthWorkspace = z.infer<typeof authWorkspaceSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

// Returned by register/login/refresh: token pair plus safe session context.
export const authSessionSchema = z.object({
  tokens: authTokensSchema,
  user: authUserSchema,
  workspace: authWorkspaceSchema,
  role: workspaceRoleSchema,
});

export type AuthSession = z.infer<typeof authSessionSchema>;

// Returned by /auth/me and consumed by the web app (never contains tokens).
export const authMeSchema = z.object({
  user: authUserSchema,
  workspace: authWorkspaceSchema,
  role: workspaceRoleSchema,
});

export type AuthMe = z.infer<typeof authMeSchema>;

export const currentWorkspaceSchema = z.object({
  workspace: authWorkspaceSchema,
  role: workspaceRoleSchema,
});

export type CurrentWorkspace = z.infer<typeof currentWorkspaceSchema>;

// ---------------------------------------------------------------------------
// Stable machine-readable error codes
// ---------------------------------------------------------------------------

export const AUTH_ERROR_CODES = [
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'INVALID_REFRESH_TOKEN',
  'SESSION_EXPIRED',
  'FORBIDDEN',
] as const;

export const authErrorCodeSchema = z.enum(AUTH_ERROR_CODES);

export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;
