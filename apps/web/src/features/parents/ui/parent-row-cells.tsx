'use client';

import Link from 'next/link';
import { SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentListItem, ParentStudentRef } from '@tutorio/validation';
import { AvatarGroup } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { parentRoleNames, telegramHandle } from '@/features/parents/model/presentation';
import { cn } from '@/lib/utils';

/**
 * A parent's role line, derived from the linked students because the model
 * holds no relation: "Parent of Anna, Mark", or "No students".
 */
export function useParentRoleLine(students: readonly Pick<ParentStudentRef, 'fullName'>[]) {
  const t = useTranslations('parents');
  return students.length > 0
    ? t('roleLine', { names: parentRoleNames(students) })
    : t('noStudents');
}

/** The one placeholder for an empty cell. */
function Dash() {
  return (
    <span aria-hidden="true" className="text-[13px] text-muted-foreground">
      —
    </span>
  );
}

/** Avatar, the name as the row's link, and the derived role line. */
export function ParentIdentityCell({
  parent,
  size = 'md',
}: {
  parent: ParentListItem;
  size?: 'md' | 'lg';
}) {
  const role = useParentRoleLine(parent.students);
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <EntityAvatar avatarKey={parent.avatarKey} fullName={parent.fullName} tint="indigo" />
      <div className="flex min-w-0 flex-col">
        <Link
          prefetch={false}
          href={`/app/parents/${parent.id}`}
          // The whole row is the target; the name carries the accessible name.
          className={cn(
            'truncate font-semibold outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring',
            size === 'lg' ? 'text-[17px] leading-[22px]' : 'text-[15px] leading-5',
          )}
        >
          {parent.fullName}
        </Link>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{role}</span>
      </div>
    </div>
  );
}

export function ParentPhoneCell({ phone }: { phone: string | null }) {
  return phone ? <span className="font-mono text-[13px] tabular-nums">{phone}</span> : <Dash />;
}

export function ParentTelegramCell({ username }: { username: string | null }) {
  const handle = telegramHandle(username);
  if (!handle) return <Dash />;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[13px] text-brand">
      <SendIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">@{handle}</span>
    </span>
  );
}

/** Overlapping avatars of the linked students with their names. */
export function ParentStudentsAvatars({
  students,
  max = 3,
}: {
  students: readonly Pick<ParentStudentRef, 'id' | 'fullName' | 'avatarKey'>[];
  max?: number;
}) {
  const visible = students.slice(0, max);
  return (
    <AvatarGroup aria-hidden="true" className="shrink-0">
      {visible.map((student) => (
        <EntityAvatar
          key={student.id}
          avatarKey={student.avatarKey}
          fullName={student.fullName}
          tint="indigo"
          size="xs"
        />
      ))}
    </AvatarGroup>
  );
}

export function ParentStudentsCell({ students }: { students: ParentListItem['students'] }) {
  const t = useTranslations('parents');
  if (students.length === 0) {
    return <Badge variant="neutral">{t('noStudents')}</Badge>;
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ParentStudentsAvatars students={students} />
      <span className="truncate text-sm">
        {students.map((student) => student.fullName).join(', ')}
      </span>
    </div>
  );
}
