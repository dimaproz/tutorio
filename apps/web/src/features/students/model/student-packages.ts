import type { PackageListFilters } from '@/lib/api/keys';

/**
 * The one package read behind a student profile. It asks for every package,
 * deleted ones included, so the read does not wait for the student record to
 * say whether the profile is archived: the profile starts it with the record,
 * and each block narrows it with {@link visibleStudentPackages}.
 */
export function studentPackagesFilters(studentId: string): PackageListFilters {
  return { page: 1, pageSize: 100, studentId, state: 'all' };
}

/**
 * What a profile shows from that read: an archived record is history and
 * keeps its deleted packages; a live one shows only live packages, exactly
 * what an `active` read would have returned.
 */
export function visibleStudentPackages<T extends { deletedAt: string | null }>(
  items: readonly T[],
  archived: boolean,
): T[] {
  return archived ? [...items] : items.filter((item) => item.deletedAt === null);
}
