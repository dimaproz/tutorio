'use client';

import Link from 'next/link';
import {
  ArchiveIcon,
  GraduationCapIcon,
  PencilIcon,
  RotateCcwIcon,
  UserIcon,
  UserRoundIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeacherResponse } from '@tutorio/validation';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export type TeacherCommands = {
  onArchive: (teacher: TeacherResponse) => void;
  onRestore: (teacher: TeacherResponse) => void;
  /** The owner turns their own teaching off (the same archive, S09 decision 1). */
  onStopTeaching: (teacher: TeacherResponse) => void;
  /** Asks to switch the studio to tutor mode; omitted where it does not apply. */
  onSwitchToSolo?: () => void;
};

/**
 * A teacher's ⋯ menu: open and edit; archive, or restore an archived one. On
 * the owner's own row archive reads «Вимкнути викладання», and the studio can
 * be switched to tutor mode from there.
 */
export function TeacherRowActions({
  teacher,
  commands,
  busy = false,
  onProfile = false,
  className,
}: {
  teacher: TeacherResponse;
  commands: TeacherCommands;
  busy?: boolean;
  /** On the profile itself: no «open» and no «edit» (the header has it). */
  onProfile?: boolean;
  className?: string;
}) {
  const t = useTranslations('teachers.row');
  const archived = teacher.status === 'ARCHIVED';

  return (
    <DropdownMenu>
      <RowActionsTrigger
        busy={busy}
        label={t('menu', { name: teacher.fullName })}
        className={className}
      />
      <DropdownMenuContent align="end">
        {onProfile ? null : (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link prefetch={false} href={`/app/teachers/${teacher.id}`}>
                  <UserIcon data-icon />
                  {t('profile')}
                </Link>
              </DropdownMenuItem>
              {archived ? null : (
                <DropdownMenuItem asChild>
                  <Link prefetch={false} href={`/app/teachers/${teacher.id}/edit`}>
                    <PencilIcon data-icon />
                    {t('edit')}
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          {archived ? (
            <DropdownMenuItem onSelect={() => commands.onRestore(teacher)}>
              {teacher.isMe ? <GraduationCapIcon data-icon /> : <RotateCcwIcon data-icon />}
              {teacher.isMe ? t('startTeaching') : t('restore')}
            </DropdownMenuItem>
          ) : teacher.isMe ? (
            <DropdownMenuItem onSelect={() => commands.onStopTeaching(teacher)}>
              <GraduationCapIcon data-icon />
              {t('stopTeaching')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => commands.onArchive(teacher)}>
              <ArchiveIcon data-icon />
              {t('archive')}
            </DropdownMenuItem>
          )}
          {teacher.isMe && commands.onSwitchToSolo ? (
            <DropdownMenuItem onSelect={commands.onSwitchToSolo}>
              <UserRoundIcon data-icon />
              {t('toSolo')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
