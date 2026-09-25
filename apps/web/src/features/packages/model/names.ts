import type { PackageResponse } from '@tutorio/validation';
import type { SaleDirection } from './sale';

type Direction = {
  group: { name: string } | null;
  teacher: { name: string; subjects: string[] };
};

/** What a direction is called: its group, else what its teacher teaches, else the teacher (S06). */
export function directionName(direction: Direction): string {
  return direction.group?.name ?? direction.teacher.subjects[0] ?? direction.teacher.name;
}

/** «student · direction · teacher» under a package's title. */
export function packageLine(pkg: Pick<PackageResponse, 'student' | 'group' | 'teacher'>): string[] {
  return [pkg.student.fullName, directionName(pkg), pkg.teacher.name];
}

/**
 * The sale shows no name field, so a package sold without one keeps its name
 * empty; it is called by its kind and size wherever it is shown.
 */
export type PackageTitle =
  | { kind: 'named'; name: string }
  | { kind: 'count'; lessons: number }
  | { kind: 'period'; from: string; lastDay: string };

export function packageTitle(
  pkg: Pick<PackageResponse, 'name' | 'lessonsTotal' | 'validFrom' | 'expiresAt' | 'sizingMode'>,
): PackageTitle {
  if (pkg.name) return { kind: 'named', name: pkg.name };
  if (pkg.sizingMode !== 'FIXED_COUNT' && pkg.validFrom && pkg.expiresAt) {
    return {
      kind: 'period',
      from: pkg.validFrom,
      lastDay: new Date(Date.parse(pkg.expiresAt) - 1).toISOString(),
    };
  }
  return { kind: 'count', lessons: pkg.lessonsTotal };
}

/** The live directions a package of `currency` can move to: the others of the student. */
export function transferTargets(
  directions: readonly SaleDirection[],
  from: { enrollmentId: string; currency: string },
) {
  return directions
    .filter(
      (direction) =>
        direction.enrollmentId !== from.enrollmentId && direction.status !== 'ARCHIVED',
    )
    .map((direction) => ({ direction, sameCurrency: direction.currency === from.currency }));
}
