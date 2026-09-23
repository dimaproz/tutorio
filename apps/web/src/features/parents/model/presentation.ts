import type { ParentStudentRef } from '@tutorio/validation';

/** The first name of a full name, as a parent's role line addresses a child. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * The names a parent's role line lists. The model has no relation or payer
 * field, so the line is derived from the linked students: one student by full
 * name, several by first name, none as an empty list.
 */
export function parentRoleNames(students: readonly Pick<ParentStudentRef, 'fullName'>[]): string {
  if (students.length === 1) return students[0].fullName;
  return students.map((student) => firstName(student.fullName)).join(', ');
}

/** The best way to reach a parent in one line: phone, then Telegram, then email. */
export function parentContactLine(parent: {
  phone?: string | null;
  telegramUsername?: string | null;
  email?: string | null;
}): string | undefined {
  const telegram = parent.telegramUsername?.replace(/^@+/, '');
  return parent.phone ?? (telegram ? `@${telegram}` : undefined) ?? parent.email ?? undefined;
}

/** A Telegram username without its "@", or null. */
export function telegramHandle(value?: string | null): string | null {
  const handle = value?.trim().replace(/^@+/, '');
  return handle ? handle : null;
}
