import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  CurrentWorkspace,
  UpdateWorkspaceSettingsDto,
  WorkspaceMemberListResponse,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  /**
   * Owner-only (controller guard). Only the two Stage 2 settings are
   * mutable here — name/plan changes are out of this endpoint's contract.
   * Existing enrollments keep their own currency/price snapshots; only
   * enrollments without a deadline override inherit the new default.
   */
  async updateSettings(
    auth: AuthenticatedUser,
    dto: UpdateWorkspaceSettingsDto,
  ): Promise<CurrentWorkspace> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.workspace.findFirst({
        where: { id: auth.workspaceId, deletedAt: null },
      });
      if (!before) {
        throw new UnauthorizedException();
      }

      const changes = this.audit.buildChanges(before, { ...dto });
      if (!changes) {
        // No-op PATCH: nothing to persist, no audit row.
        return;
      }

      await tx.workspace.update({
        where: { id: before.id },
        data: dto,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'WORKSPACE',
        entityId: before.id,
        changes,
      });
    });
    return this.getCurrent(auth);
  }

  /** Read-only roster for the teacher selector. */
  async listMembers(
    auth: AuthenticatedUser,
  ): Promise<WorkspaceMemberListResponse> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { user: { select: { name: true, email: true } } },
    });
    return {
      items: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
    };
  }
}
