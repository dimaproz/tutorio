import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CurrentWorkspace } from '@tutorio/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(auth: AuthenticatedUser): Promise<CurrentWorkspace> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: auth.workspaceId,
          userId: auth.userId,
        },
      },
      include: { workspace: true },
    });
    if (!membership || membership.workspace.deletedAt) {
      throw new UnauthorizedException();
    }
    return {
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        plan: membership.workspace.plan,
        defaultCurrency: membership.workspace.defaultCurrency,
        cancellationDeadlineHours:
          membership.workspace.cancellationDeadlineHours,
      },
      role: membership.role,
    };
  }
}
