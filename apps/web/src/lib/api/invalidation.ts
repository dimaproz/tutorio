import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type {
  CreateParentDto,
  CreateStudentDto,
  UpdateParentDto,
  UpdateStudentDto,
  UpdateTeacherDto,
  UpdateWorkspaceSettingsDto,
} from '@tutorio/validation';
import { SESSION_QUERY_KEY } from '@/lib/auth/client';
import { queryKeys } from './keys';

/**
 * One cache entry a mutation outdates. By default every mounted query under
 * the key is read again at once; `refetchType: 'none'` only marks it stale,
 * for data that is not on screen while the mutation runs (the audit log, the
 * other side of a roster) and is read again the next time it is shown.
 */
export type Invalidation = { queryKey: QueryKey; refetchType?: 'none' };

export function applyInvalidations(
  queryClient: QueryClient,
  invalidations: readonly Invalidation[],
): void {
  for (const { queryKey, refetchType } of invalidations) {
    void queryClient.invalidateQueries({ queryKey, refetchType });
  }
}

const stale = (queryKey: QueryKey): Invalidation => ({ queryKey, refetchType: 'none' });
const refetch = (queryKey: QueryKey): Invalidation => ({ queryKey });

/** Whether a PATCH body carries anything but the given keys. */
const touchesMoreThan = (dto: object, keys: readonly string[]) =>
  Object.keys(dto).some((key) => !keys.includes(key));

export type StudentChange =
  | { kind: 'create'; dto: CreateStudentDto }
  | { kind: 'update'; dto: UpdateStudentDto }
  | { kind: 'archive' }
  | { kind: 'restore' };

/**
 * What a student mutation outdates. `students.all` covers the lists and the
 * profile, so the profile is never invalidated twice.
 */
export function studentInvalidations(change: StudentChange): Invalidation[] {
  const dto = 'dto' in change ? change.dto : undefined;
  const archiveOrRestore = change.kind === 'archive' || change.kind === 'restore';
  const lifecycle = archiveOrRestore || (dto !== undefined && 'status' in dto);
  // The student's name, avatar and lifecycle show on other records.
  const identity =
    lifecycle ||
    (change.kind === 'update' && ('fullName' in change.dto || 'avatarKey' in change.dto));
  const linksChanged =
    change.kind === 'create'
      ? Boolean(change.dto.parentIds?.length)
      : change.kind === 'update' && 'parentIds' in change.dto;

  const invalidations = [refetch(queryKeys.students.all)];
  // A student's parent links are the other side of each parent's roster.
  if (linksChanged) invalidations.push(refetch(queryKeys.parents.all));
  else if (identity) invalidations.push(stale(queryKeys.parents.all));
  // Enrollments follow the student's lifecycle.
  if (lifecycle) invalidations.push(refetch(queryKeys.enrollments.all));
  // Archiving drops the student's future individual lessons; restoring brings
  // them back.
  if (archiveOrRestore) {
    invalidations.push(refetch(queryKeys.lessons.all), refetch(queryKeys.series.all));
  }
  if (identity) {
    invalidations.push(stale(queryKeys.groups.all), stale(queryKeys.packages.all));
  }
  invalidations.push(stale(queryKeys.audit.all));
  return invalidations;
}

export type ParentChange =
  | { kind: 'create'; dto: CreateParentDto }
  | { kind: 'update'; dto: UpdateParentDto }
  | { kind: 'delete' };

/** What a parent mutation outdates; `parents.all` covers the parent profile. */
export function parentInvalidations(change: ParentChange): Invalidation[] {
  const linksChanged =
    change.kind === 'delete' ||
    (change.kind === 'create'
      ? Boolean(change.dto.studentIds?.length)
      : 'studentIds' in change.dto);
  // A student profile shows each parent's name and contacts, not their notes.
  const identity = change.kind === 'update' && touchesMoreThan(change.dto, ['notes']);

  const invalidations = [refetch(queryKeys.parents.all)];
  if (linksChanged) invalidations.push(refetch(queryKeys.students.all));
  else if (identity) invalidations.push(stale(queryKeys.students.all));
  invalidations.push(stale(queryKeys.audit.all));
  return invalidations;
}

export type TeacherChange =
  { kind: 'create' } | { kind: 'update'; dto: UpdateTeacherDto } | { kind: 'delete' };

/**
 * What a teacher mutation outdates. Names and colours surface on enrollments,
 * groups and the calendar, none of which is on screen on a teacher page.
 */
export function teacherInvalidations(change: TeacherChange): Invalidation[] {
  const invalidations = [refetch(queryKeys.teachers.all)];
  const shown =
    change.kind === 'delete' ||
    (change.kind === 'update' && touchesMoreThan(change.dto, ['bio', 'notes']));
  if (shown) {
    invalidations.push(
      stale(queryKeys.enrollments.all),
      stale(queryKeys.groups.all),
      stale(queryKeys.lessons.all),
    );
  }
  invalidations.push(stale(queryKeys.audit.all));
  return invalidations;
}

/**
 * What a workspace settings change outdates. The session carries the
 * workspace defaults and mode the shell reads; the effective cancellation
 * deadline shows on enrollments and on the student profile. The audit log
 * lives on the settings page itself, so it is read again at once.
 */
export function workspaceSettingsInvalidations(dto: UpdateWorkspaceSettingsDto): Invalidation[] {
  const invalidations = [refetch(SESSION_QUERY_KEY), stale(queryKeys.workspace.current)];
  if ('cancellationDeadlineHours' in dto) {
    invalidations.push(stale(queryKeys.enrollments.all), stale(queryKeys.students.all));
  }
  invalidations.push(refetch(queryKeys.audit.all));
  return invalidations;
}
