'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BanknoteIcon, LayersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeacherListItem } from '@tutorio/validation';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { cn } from '@/lib/utils';
import { teacherColor } from '../model/presentation';
import { TEACHER_TINT, TeacherAvatar, TeacherCircles, teacherStyle } from './teacher-art';
import { TeacherSubjectChips, YouBadge, useJoinedDate, useTeacherRate } from './teacher-parts';
import { TeacherRowActions, type TeacherCommands } from './teacher-row-actions';

/** Monday first, the way the bars read. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
/** The tallest bar, px. */
const BAR_MAX = 36;

function FigureChip({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-item bg-background px-3 py-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-tile [&_svg]:size-4.5',
          TEACHER_TINT.tile,
          // On a tablet two cards share a row: the tile goes so «450 ₴» stays on one line.
          'md:max-xl:hidden',
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[17px] leading-6 font-semibold tabular-nums">{value}</span>
        <span className="truncate text-xs leading-4 text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

/**
 * A teacher as a card (the cards view, tablets and phones): a band in the
 * teacher's colour with the background circles and the ⋯ menu, the ringed
 * avatar overlapping it (the owner's with the crown), the name and subjects,
 * the groups and the rate, this week's lessons as seven day bars, and since
 * when they teach. No student information (S09 handoff).
 */
export function TeacherCard({
  teacher,
  commands,
}: {
  teacher: TeacherListItem;
  commands: TeacherCommands;
}) {
  const t = useTranslations('teachers');
  const days = useWeekdayLabels();
  const joined = useJoinedDate();
  const rate = useTeacherRate()(teacher);
  const archived = teacher.status === 'ARCHIVED';
  const peak = Math.max(1, ...teacher.week.days);

  return (
    <article
      data-slot="teacher-card"
      data-archived={archived || undefined}
      style={teacherStyle(archived ? 'var(--muted-foreground)' : teacherColor(teacher))}
      className="relative flex flex-col overflow-hidden rounded-card bg-card pb-5 text-card-foreground transition-colors duration-150 has-[a:hover]:bg-surface-hover"
    >
      <div className={cn('relative h-18 shrink-0', TEACHER_TINT.band)}>
        <TeacherCircles variant="band" className="right-14 opacity-50" />
        <TeacherRowActions
          teacher={teacher}
          commands={commands}
          className="absolute top-2 right-2 z-1 md:size-9"
        />
      </div>
      <div className="relative -mt-9 px-4">
        <TeacherAvatar
          avatarKey={teacher.avatarKey}
          fullName={teacher.fullName}
          color={teacherColor(teacher)}
          size="lg"
          framed
          owner={teacher.isMe}
          crownLabel={t('owner')}
          muted={archived}
        />
      </div>
      <div className="flex flex-col gap-2 px-5 pt-2">
        <span className="flex min-w-0 items-center gap-2">
          <Link
            prefetch={false}
            href={`/app/teachers/${teacher.id}`}
            aria-label={t('row.open', { name: teacher.fullName })}
            className="truncate text-[17px] leading-6 font-semibold outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {teacher.fullName}
          </Link>
          {teacher.isMe ? <YouBadge /> : null}
        </span>
        <TeacherSubjectChips subjects={teacher.subjects} />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        <FigureChip
          icon={<LayersIcon />}
          value={String(teacher.groupCount)}
          label={t('card.groups', { count: teacher.groupCount })}
        />
        <FigureChip
          icon={<BanknoteIcon />}
          value={rate?.text ?? t('noRate')}
          label={rate ? t('card.perLesson') : t('card.noRate')}
        />
      </div>
      <section className="mx-4 mt-2 flex flex-col gap-3 rounded-item bg-background px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {t('card.thisWeek')}
          </h3>
          <span className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {teacher.week.lessonCount}
            </span>{' '}
            {t('card.weekLessons', { count: teacher.week.lessonCount })}
          </span>
        </div>
        <ol className="grid grid-cols-7 items-end gap-1.5">
          {teacher.week.days.map((count, index) => {
            const day = days[WEEK[index]!] ?? '';
            return (
              <li
                key={day}
                aria-label={t('card.dayBar', { day, count })}
                className="flex flex-col items-center gap-1.5"
              >
                <span className="flex h-9 w-full items-end" aria-hidden="true">
                  <span
                    className={cn(
                      'w-full rounded-[6px]',
                      count > 0 ? 'bg-(--teacher)' : 'bg-border',
                    )}
                    style={{ height: count > 0 ? Math.max(6, (count / peak) * BAR_MAX) : 3 }}
                  />
                </span>
                <span aria-hidden="true" className="text-[11px] text-muted-foreground capitalize">
                  {day}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <p className="px-5 pt-4 text-sm text-muted-foreground">
        {teacher.isMe ? t('owner') : t('teachesSince', { date: joined(teacher) })}
      </p>
    </article>
  );
}
