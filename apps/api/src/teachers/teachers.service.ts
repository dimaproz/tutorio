import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateTeacherDto,
  ListTeachersQueryDto,
  TeacherListItem,
  TeacherListResponse,
  TeacherResponse,
  TeacherSortDto,
  UpdateTeacherDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  invalidWorkspaceRelation,
  soloModeSingleTeacher,
  teacherNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { loadTeacherStats } from './teacher-stats';

export type TeacherRow = Prisma.TeacherGetPayload<{
  include: { workspaceMember: { select: { userId: true } } };
}>;

// Resolved through the linked membership so the flag survives a member being
// re-invited: identity is the user account, not the membership row.
export const withMemberUser = {
  workspaceMember: { select: { userId: true } },
} satisfies Prisma.TeacherInclude;

export function toTeacherResponse(
  row: TeacherRow,
  viewerUserId: string,
): TeacherResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    telegramUsername: row.telegramUsername,
    subjects: row.subjects,
    bio: row.bio,
    defaultRateMinor: row.defaultRateMinor,
    currency: row.currency as TeacherResponse['currency'],
    color: row.color,
    avatarKey: row.avatarKey as TeacherResponse['avatarKey'],
    status: row.status,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    workspaceMemberId: row.workspaceMemberId,
    isMe: row.workspaceMember?.userId === viewerUserId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

/** The state, status, subject and search filters of the list. */
function matchesQuery(row: TeacherRow, query: ListTeachersQueryDto): boolean {
  if (query.state === 'active' && row.deletedAt) return false;
  if (query.state === 'deleted' && !row.deletedAt) return false;
  if (query.status && row.status !== query.status) return false;
  const lower = (value: string) => value.toLocaleLowerCase();
  if (
    query.subject &&
    !row.subjects.some((subject) => lower(subject) === lower(query.subject!))
  ) {
    return false;
  }
  if (query.search) {
    const needle = lower(query.search);
    const fields = [
      row.fullName,
      row.email,
      row.phone,
      row.telegramUsername,
      ...row.subjects,
    ];
    return fields.some((field) => field && lower(field).includes(needle));
  }
  return true;
}

/** The chosen order, the caller's own profile first. */
function sortTeachers(
  items: TeacherListItem[],
  sort: TeacherSortDto,
): TeacherListItem[] {
  const byName = (a: TeacherListItem, b: TeacherListItem) =>
    a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id);
  const order: Record<
    TeacherSortDto,
    (a: TeacherListItem, b: TeacherListItem) => number
  > = {
    name: byName,
    workload: (a, b) => b.week.lessonCount - a.week.lessonCount || byName(a, b),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b),
  };
  return [...items].sort(
    (a, b) => Number(b.isMe) - Number(a.isMe) || order[sort](a, b),
  );
}

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * A studio has a handful of teachers, so the page is cut in memory: the
   * workload sort and the subject search need every teacher's figures anyway.
   * The caller's own profile comes first and, while its teaching is off, is
   * left out of the lists and the counts and comes back as `me`.
   */
  async list(
    auth: AuthenticatedUser,
    query: ListTeachersQueryDto,
  ): Promise<TeacherListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const [workspace, rows] = await Promise.all([
      this.prisma.workspace.findFirstOrThrow({
        where: { id: auth.workspaceId },
        select: { timezone: true },
      }),
      this.prisma.teacher.findMany({
        where: { workspaceId: auth.workspaceId },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        include: withMemberUser,
      }),
    ]);
    const isMe = (row: TeacherRow) =>
      row.workspaceMember?.userId === auth.userId;
    const mine = rows.find((row) => isMe(row) && !row.deletedAt) ?? null;
    const listed = rows.filter(
      (row) => !(isMe(row) && row.status === 'ARCHIVED'),
    );
    const live = listed.filter((row) => !row.deletedAt);
    const matching = listed.filter((row) => matchesQuery(row, query));

    const ids = new Set(matching.map((row) => row.id));
    if (mine) ids.add(mine.id);
    const stats = await loadTeacherStats(
      this.prisma,
      auth.workspaceId,
      [...ids],
      workspace.timezone,
      new Date(),
    );
    const toItem = (row: TeacherRow): TeacherListItem => ({
      ...toTeacherResponse(row, auth.userId),
      ...stats.get(row.id)!,
    });
    const items = sortTeachers(matching.map(toItem), query.sort);
    const skip = (query.page - 1) * query.pageSize;

    return {
      ...buildPaginatedResponse(
        items.slice(skip, skip + query.pageSize),
        items.length,
        query,
      ),
      counts: {
        active: live.filter((row) => row.status === 'ACTIVE').length,
        archived: live.filter((row) => row.status === 'ARCHIVED').length,
        all: live.length,
      },
      me: mine ? toItem(mine) : null,
    };
  }

  async getDetail(
    auth: AuthenticatedUser,
    teacherId: string,
  ): Promise<TeacherResponse> {
    const row = await this.prisma.teacher.findFirst({
      where: { id: teacherId, workspaceId: auth.workspaceId, deletedAt: null },
      include: withMemberUser,
    });
    if (!row) {
      throw teacherNotFound();
    }
    return toTeacherResponse(row, auth.userId);
  }

  /** Throws if the linked member is missing/foreign or already linked. */
  private async assertMemberLinkable(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    memberId: string,
    excludeTeacherId?: string,
  ): Promise<void> {
    const member = await tx.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true },
    });
    if (!member) {
      throw invalidWorkspaceRelation();
    }
    const linked = await tx.teacher.findFirst({
      where: {
        workspaceMemberId: memberId,
        ...(excludeTeacherId ? { id: { not: excludeTeacherId } } : {}),
      },
      select: { id: true },
    });
    if (linked) {
      throw invalidWorkspaceRelation();
    }
  }

  /**
   * SOLO workspaces already own the caller's teaching profile and show no
   * teacher controls: a second live ACTIVE profile would be invisible and
   * unusable. A per-workspace advisory lock serializes every command that can
   * produce an ACTIVE profile, so two concurrent requests cannot both pass
   * the count.
   */
  async assertSoloTeacherSlot(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    excludeTeacherId?: string,
  ): Promise<void> {
    const workspace = await tx.workspace.findFirstOrThrow({
      where: { id: workspaceId },
      select: { mode: true },
    });
    if (workspace.mode !== 'SOLO') {
      return;
    }
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${workspaceId}:solo-teacher`}))`;
    }
    const existing = await tx.teacher.count({
      where: {
        workspaceId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(excludeTeacherId ? { id: { not: excludeTeacherId } } : {}),
      },
    });
    if (existing > 0) {
      throw soloModeSingleTeacher();
    }
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateTeacherDto,
  ): Promise<TeacherResponse> {
    const teacher = await this.prisma.$transaction(async (tx) => {
      if (dto.workspaceMemberId) {
        await this.assertMemberLinkable(
          tx,
          auth.workspaceId,
          dto.workspaceMemberId,
        );
      }
      if (dto.status === 'ACTIVE') {
        await this.assertSoloTeacherSlot(tx, auth.workspaceId);
      }
      const created = await tx.teacher.create({
        data: {
          workspaceId: auth.workspaceId,
          subjects: [],
          ...dto,
          archivedAt: dto.status === 'ARCHIVED' ? new Date() : null,
        },
        include: withMemberUser,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'TEACHER',
        entityId: created.id,
        changes: this.audit.buildChanges({}, dto),
      });
      return created;
    });
    return toTeacherResponse(teacher, auth.userId);
  }

  async update(
    auth: AuthenticatedUser,
    teacherId: string,
    dto: UpdateTeacherDto,
  ): Promise<TeacherResponse> {
    const teacher = await this.prisma.$transaction(async (tx) => {
      const before = await tx.teacher.findFirst({
        where: {
          id: teacherId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        include: withMemberUser,
      });
      if (!before) {
        throw teacherNotFound();
      }
      const changes = this.audit.buildChanges(before, dto);
      if (!changes) {
        return before;
      }
      if (dto.workspaceMemberId) {
        await this.assertMemberLinkable(
          tx,
          auth.workspaceId,
          dto.workspaceMemberId,
          before.id,
        );
      }
      if (dto.status === 'ACTIVE' && before.status !== 'ACTIVE') {
        await this.assertSoloTeacherSlot(tx, auth.workspaceId, before.id);
      }
      const statusChanged = dto.status && dto.status !== before.status;
      const updated = await tx.teacher.update({
        where: { id: before.id },
        data: {
          ...dto,
          ...(statusChanged
            ? { archivedAt: dto.status === 'ARCHIVED' ? new Date() : null }
            : {}),
        },
        include: withMemberUser,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'TEACHER',
        entityId: before.id,
        changes,
      });
      return updated;
    });
    return toTeacherResponse(teacher, auth.userId);
  }

  /** Soft-delete; the teacher is hidden from pickers but keeps its history. */
  async softDelete(auth: AuthenticatedUser, teacherId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { id: teacherId, workspaceId: auth.workspaceId },
      });
      if (!teacher) {
        throw teacherNotFound();
      }
      if (teacher.deletedAt) {
        return;
      }
      await tx.teacher.update({
        where: { id: teacher.id },
        data: { deletedAt: new Date() },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'TEACHER',
        entityId: teacher.id,
      });
    });
  }

  /**
   * Brings a teacher back: a soft-deleted profile is undeleted with the
   * status it had; a live archived one becomes active again (the owner's «Я
   * теж викладаю», «Відновити» on an archived profile).
   */
  async restore(
    auth: AuthenticatedUser,
    teacherId: string,
  ): Promise<TeacherResponse> {
    const teacher = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.teacher.findFirst({
        where: { id: teacherId, workspaceId: auth.workspaceId },
        include: withMemberUser,
      });
      if (!existing) {
        throw teacherNotFound();
      }
      const activates = !existing.deletedAt && existing.status === 'ARCHIVED';
      if (!existing.deletedAt && !activates) {
        return existing;
      }
      if (existing.status === 'ACTIVE' || activates) {
        await this.assertSoloTeacherSlot(tx, auth.workspaceId, existing.id);
      }
      const restored = await tx.teacher.update({
        where: { id: existing.id },
        data: activates
          ? { status: 'ACTIVE', archivedAt: null }
          : { deletedAt: null },
        include: withMemberUser,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'RESTORE',
        entity: 'TEACHER',
        entityId: existing.id,
        ...(activates
          ? {
              changes: {
                fields: { status: { before: 'ARCHIVED', after: 'ACTIVE' } },
              },
            }
          : {}),
      });
      return restored;
    });
    return toTeacherResponse(teacher, auth.userId);
  }
}
