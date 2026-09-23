'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import type { StudentRollup } from '@/features/students/model/rollups';
import { cn } from '@/lib/utils';
import {
  STATUS_DOT,
  StudentBalanceCell,
  StudentCreditsCell,
  StudentNextLessonCell,
  useStudentSubtitle,
  type PackagesReadState,
} from './student-row-cells';

/**
 * The phone representation of a student in the collection: identity with the
 * balance chip, then the credits meter and the next lesson. The whole card is
 * the link to the profile; an archived student reads dimmed.
 */
export function StudentCard({
  student,
  rollup,
  packages = 'ready',
  now,
}: {
  student: StudentListItem;
  rollup?: StudentRollup;
  packages?: PackagesReadState;
  now: number;
}) {
  const tStatus = useTranslations('studentStatus');
  const subtitle = useStudentSubtitle(student);
  const archived = student.status === 'ARCHIVED';

  return (
    <article
      data-slot="student-card"
      className={cn(
        'relative flex flex-col gap-3 rounded-row bg-card p-4 text-card-foreground transition-colors duration-150 has-[a:hover]:bg-surface-hover',
        archived && 'text-muted-foreground [&_img]:grayscale',
      )}
    >
      <div className="flex items-center gap-3">
        <EntityAvatar
          avatarKey={student.avatarKey}
          fullName={student.fullName}
          status={STATUS_DOT[student.status]}
          statusLabel={tStatus(student.status)}
        />
        <div className="flex min-w-0 grow flex-col">
          <Link
            href={`/app/students/${student.id}`}
            className="text-[17px] leading-[22px] font-semibold outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {student.fullName}
          </Link>
          {subtitle ? (
            <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </div>
        <StudentBalanceCell balance={rollup?.balance} status={student.status} packages={packages} />
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
        <StudentCreditsCell credits={rollup?.credits} packages={packages} />
        <StudentNextLessonCell status={student.status} next={rollup?.next} now={now} align="end" />
      </div>
    </article>
  );
}
