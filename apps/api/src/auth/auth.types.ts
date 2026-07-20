import type { WorkspaceRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  workspaceId: string;
  role: WorkspaceRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  workspaceId: string;
  type: 'refresh';
  jti: string;
}

// Attached to the request by AccessTokenGuard.
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  workspaceId: string;
  role: WorkspaceRole;
}
