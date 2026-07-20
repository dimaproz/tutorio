import { SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Restricts a route to the given workspace roles (enforced by RolesGuard).
export const Roles = (...roles: WorkspaceRole[]) =>
  SetMetadata(ROLES_KEY, roles);
