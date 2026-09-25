'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { GroupAttendanceResponse } from '@tutorio/validation';
import type { AttendanceTipContent } from '@/components/shared/attendance-tip';
import { missStreaks, windowLessonFacts } from '@/features/groups/model/presentation';
import { capitalizeFirst } from '@/lib/utils';

type Lesson = GroupAttendanceResponse['lessons'][number];
type Row = GroupAttendanceResponse['rows'][number];

const CANCELLED = new Set(['CANCELLED_CHARGED', 'CANCELLED_UNCHARGED']);

/**
 * The attendance tooltips (S08 decision 7): «Чт, 3 вер · Vocabulary:
 * travel», then — on a member's cell — whether they came, with their run of
 * misses in a row; on the metric's cell, how many came and who missed.
 */
export function useAttendanceTips(attendance: GroupAttendanceResponse | undefined) {
  const t = useTranslations('groups.attendance');
  const tStats = useTranslations('groups.stats');
  const format = useFormatter();
  const lessons = attendance?.lessons ?? [];

  const title = (lesson: Lesson | undefined) =>
    lesson
      ? [
          capitalizeFirst(
            format.dateTime(new Date(lesson.startsAtUtc), {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }),
          ),
          lesson.topic,
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  /** One tooltip per cell of a member's row. */
  const rowTips = (row: Row): AttendanceTipContent[] => {
    const name = row.student.fullName.split(/\s+/)[0] ?? row.student.fullName;
    const streaks = missStreaks(row.cells);
    return row.cells.map((cell, index) => {
      const streak = streaks[index];
      const line =
        cell === 'present'
          ? { tone: 'present' as const, text: t('tipPresent', { name }) }
          : cell === 'absent'
            ? { tone: 'absent' as const, text: t('tipAbsent', { name }) }
            : cell === 'excused'
              ? { tone: 'excused' as const, text: t('tipExcused', { name }) }
              : cell === 'cancelled'
                ? { tone: 'muted' as const, text: t('tipCancelled') }
                : { tone: 'muted' as const, text: t('tipUnmarked') };
      return {
        title: title(lessons[index]),
        lines: [line],
        note: streak ? t('tipStreak', streak) : undefined,
      };
    });
  };

  /** One tooltip per lesson of the metric: who came, who missed. */
  const lessonTips = (): AttendanceTipContent[] =>
    attendance
      ? windowLessonFacts(attendance).map((facts) => ({
          title: title(facts.lesson),
          lines: CANCELLED.has(facts.lesson.status)
            ? [{ tone: 'muted' as const, text: t('tipCancelled') }]
            : facts.counted === 0
              ? [{ tone: 'muted' as const, text: t('tipUnmarked') }]
              : [
                  {
                    tone: 'present' as const,
                    text: tStats('tipCame', { present: facts.present, counted: facts.counted }),
                  },
                  facts.missed.length > 0
                    ? {
                        tone: 'absent' as const,
                        text: tStats('tipMissed', { names: format.list(facts.missed) }),
                      }
                    : { tone: 'muted' as const, text: tStats('tipNoMisses') },
                ],
        }))
      : [];

  return { rowTips, lessonTips };
}
