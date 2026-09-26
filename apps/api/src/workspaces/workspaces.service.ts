import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  AvatarKeyDto,
  CurrentWorkspace,
  UpdateWorkspaceSettingsDto,
  WorkspaceMemberListResponse,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  soloModeSingleTeacher,
  soloOwnerMustTeach,
} from '../common/business.errors';
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
        mode: membership.workspace.mode,
        defaultCurrency: membership.workspace.defaultCurrency,
        cancellationDeadlineHours:
          membership.workspace.cancellationDeadlineHours,
        timezone: membership.workspace.timezone,
        scheduleHorizonWeeks: membership.workspace.scheduleHorizonWeeks,
        lowCreditThreshold: membership.workspace.lowCreditThreshold,
      },
      role: membership.role,
    };
  }

  /**
   * Owner-only (controller guard). The studio's name, defaults and mode are
   * mutable here — the plan and the timezone are out of this endpoint's
   * contract (a timezone change would move every lesson's wall clock).
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

      // SOLO implies "the owner is the only teacher": switching back while a
      // second active profile exists would hide schedules nobody can reach.
      if (dto.mode === 'SOLO' && before.mode !== 'SOLO') {
        const activeTeachers = await tx.teacher.count({
          where: {
            workspaceId: before.id,
            deletedAt: null,
            status: 'ACTIVE',
          },
        });
        if (activeTeachers > 1) {
          throw soloModeSingleTeacher();
        }
        // A solo tutor is the teacher: an owner who turned teaching off
        // cannot go solo until they teach again.
        const own = await tx.teacher.findFirst({
          where: {
            workspaceId: before.id,
            deletedAt: null,
            workspaceMember: { userId: auth.userId },
          },
          select: { status: true },
        });
        if (own && own.status !== 'ACTIVE') {
          throw soloOwnerMustTeach();
        }
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

  /**
   * Read-only roster: the people who can change something, with the avatar
   * of their teaching profile (the audit log's «Хто» filter).
   */
  async listMembers(
    auth: AuthenticatedUser,
  ): Promise<WorkspaceMemberListResponse> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        user: { select: { name: true, email: true } },
        teacherProfile: { select: { avatarKey: true, deletedAt: true } },
      },
    });
    return {
      items: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        avatarKey: member.teacherProfile?.deletedAt
          ? null
          : ((member.teacherProfile?.avatarKey ?? null) as AvatarKeyDto | null),
      })),
    };
  }
}
