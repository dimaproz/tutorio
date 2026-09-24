'use client';

import { useMemo } from 'react';
import { CircleSlashIcon, ClipboardCheckIcon, ClockIcon, PencilIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonDetailResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceSummaryCard } from '@/components/shared/attendance-summary-card';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { MemberChargeRow, type MemberNoteTone } from '@/components/shared/member-charge-row';
import {
  groupPackagesFilters,
  useGroupQuery,
  useLessonAttendanceQuery,
  usePackagesQuery,
} from '../api';
import { lastAttendanceMark, type HistoryEvent } from '../model/history';
import {
  activeCount,
  attendanceCounts,
  chargedCount,
  memberRows,
  type MemberBadge,
  type MemberRow,
} from '../model/members';
import { lessonMoment } from '../model/panel-actions';
import { useLessonDates, useMoney } from './lesson-format';

/** The group, the attendance sheet and the members' packages of one group lesson. */
export function useGroupMembers(lesson: LessonDetailResponse) {
  const groupId = lesson.groupId ?? '';
  const group = useGroupQuery(groupId, Boolean(groupId));
  const sheet = useLessonAttendanceQuery(lesson.id, Boolean(groupId));
  const packages = usePackagesQuery(groupPackagesFilters(groupId), Boolean(groupId));
  const rows = useMemo(
    () =>
      memberRows({
        lesson,
        sheet: sheet.data,
        enrollments: group.data?.enrollments ?? [],
        packages: packages.data?.items ?? [],
      }),
    [group.data, lesson, packages.data, sheet.data],
  );
  return {
    rows,
    group: group.data,
    loading: sheet.isPending || group.isPending,
  };
}

const MARK_TONE: Record<NonNullable<MemberRow['mark']>, MemberNoteTone> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  EXCUSED: 'info',
};

function MemberBadgeChip({ badge }: { badge: MemberBadge }) {
  const t = useTranslations('lessons.members.badge');
  const money = useMoney();
  switch (badge.kind) {
    case 'paused':
      return (
        <Badge variant="warning" dot>
          {t('paused')}
        </Badge>
      );
    case 'package':
      return (
        <Badge
          variant={badge.tone === 'neutral' ? 'neutral' : badge.tone}
          dot={badge.tone !== 'neutral'}
        >
          {t('package', { left: badge.left, total: badge.total })}
        </Badge>
      );
    case 'perLesson':
      return (
        <Badge variant="neutral">
          {t('perLesson', { amount: money(badge.amountMinor, badge.currency) })}
        </Badge>
      );
    case 'charged':
      return (
        <Badge
          variant={badge.tone === 'neutral' ? 'success' : badge.tone}
          dot={badge.tone !== 'neutral'}
        >
          {t('charged', { left: badge.left })}
        </Badge>
      );
    case 'exhausted':
      return (
        <Badge variant="danger" dot>
          {t('exhausted')}
        </Badge>
      );
    case 'debt':
      return (
        <Badge variant="danger" dot>
          {t('debt', { amount: money(badge.amountMinor, badge.currency) })}
        </Badge>
      );
    case 'paid':
      return (
        <Badge variant="success">
          {t('paid', { amount: money(badge.amountMinor, badge.currency) })}
        </Badge>
      );
    case 'notCharged':
      return <Badge variant="info">{t('notCharged')}</Badge>;
  }
}

/** The members card: one row per member with the mark and the charge. */
export function LessonMembers({
  rows,
  loading,
  mobile,
}: {
  rows: MemberRow[];
  loading: boolean;
  mobile: boolean;
}) {
  const t = useTranslations('lessons.members');
  const note = (row: MemberRow) => {
    if (!row.note) return undefined;
    switch (row.note.kind) {
      case 'mark':
        return { label: t(`mark.${row.note.mark}`), tone: MARK_TONE[row.note.mark] };
      case 'paused':
        return { label: t('paused'), tone: 'warning' as const };
      case 'runningOut':
        return { label: t('runningOut'), tone: 'warning' as const };
      case 'lastCredit':
        return { label: t('lastCredit'), tone: 'danger' as const };
    }
  };
  return (
    <section
      aria-label={t('title', { count: rows.length })}
      className="flex shrink-0 flex-col gap-3.5"
    >
      <h3 className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {t('title', { count: rows.length })}
      </h3>
      <div className="flex flex-col rounded-row border border-border bg-card px-4 py-2">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="my-2 h-10 w-full rounded-control" />
            ))
          : rows.map((row) => (
              <MemberChargeRow
                key={row.enrollmentId}
                stacked={mobile}
                media={
                  <EntityAvatar
                    avatarKey={row.student.avatarKey}
                    fullName={row.student.fullName}
                    size="md"
                  />
                }
                name={row.student.fullName}
                note={note(row)}
                badge={row.badge ? <MemberBadgeChip badge={row.badge} /> : undefined}
              />
            ))}
      </div>
    </section>
  );
}

/**
 * Who came, at the top of a group lesson's right column (S01 board 02):
 * before the start a note, while it runs "not marked yet" with "Mark", once
 * held the four mark tiles with "Change", and for a cancelled lesson a note
 * that no attendance is kept.
 */
export function LessonAttendanceSummary({
  lesson,
  rows,
  history,
  now,
  onMark,
}: {
  lesson: LessonDetailResponse;
  rows: MemberRow[];
  history: HistoryEvent[];
  now: number;
  onMark: () => void;
}) {
  const t = useTranslations('lessons.attendance');
  const dates = useLessonDates();

  if (lesson.status === 'CANCELLED_CHARGED' || lesson.status === 'CANCELLED_UNCHARGED') {
    return (
      <AttendanceSummaryCard
        tone="plain"
        icon={<CircleSlashIcon />}
        title={t('cancelledTitle')}
        text={
          lesson.status === 'CANCELLED_CHARGED' ? t('cancelledChargedText') : t('cancelledText')
        }
      />
    );
  }
  const moment = lessonMoment(lesson, now);
  if (lesson.status === 'SCHEDULED' && moment === 'upcoming') {
    return (
      <AttendanceSummaryCard
        tone="plain"
        icon={<ClockIcon />}
        title={t('afterStartTitle')}
        text={t('afterStartText')}
      />
    );
  }

  const counts = attendanceCounts(rows);
  const marked = rows.some((row) => !row.paused && row.mark !== null);
  if (lesson.status === 'SCHEDULED' && !marked) {
    return (
      <AttendanceSummaryCard
        tone="indigo"
        label={t('label')}
        title={t('notMarkedTitle')}
        action={
          <Button type="button" variant="white" size="xs" onClick={onMark}>
            <ClipboardCheckIcon data-icon="inline-start" />
            {t('mark')}
          </Button>
        }
        text={t('notMarkedText', {
          time: dates.time(lesson.startsAtUtc),
          count: activeCount(rows),
        })}
      />
    );
  }

  // A lesson held without anyone marking it was marked by the automation (L-72).
  const last = lastAttendanceMark(history);
  const byPerson = Boolean(last?.actor);
  const charged = chargedCount(rows);
  return (
    <AttendanceSummaryCard
      tone="indigo"
      label={t('label')}
      title={byPerson ? t('markedTitle') : t('noMarksTitle')}
      action={
        <Button type="button" variant="white" size="xs" onClick={onMark}>
          <PencilIcon data-icon="inline-start" />
          {t('change')}
        </Button>
      }
      tiles={[
        { id: 'present', label: t('tile.present'), count: counts.present, tone: 'success' },
        { id: 'absent', label: t('tile.absent'), count: counts.absent, tone: 'danger' },
        { id: 'excused', label: t('tile.excused'), count: counts.excused, tone: 'info' },
        { id: 'paused', label: t('tile.paused'), count: counts.paused, tone: 'warning' },
      ]}
      note={
        !byPerson
          ? t('noMarksNote')
          : last && last.actor
            ? t('chargedNote', { count: charged, actor: last.actor, time: dates.time(last.at) })
            : t('chargedNoteShort', { count: charged })
      }
    />
  );
}
