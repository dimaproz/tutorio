'use client';

import { useState } from 'react';
import { ClipboardCheckIcon, RotateCcwIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { GroupAttendanceResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AttendanceList,
  type AttendanceListRow,
} from '@/components/shared/attendance-list';
import { EmptyState } from '@/components/shared/empty-state';
import { shortName } from '@/features/groups/model/presentation';
import { useIsMobile } from '@/hooks/use-mobile';

/** Phones show this many rows before "all students". */
const PHONE_ROWS = 3;

type Row = GroupAttendanceResponse['rows'][number];

/**
 * The group's attendance over its last held lessons, in the shared
 * `AttendanceList`. The API applies the rules (cancelled lessons are nobody's
 * miss, a student on hold is left out, "at risk" is two absences in a row);
 * this card turns them into the tiles, notes and tones.
 */
export function GroupAttendanceCard({
  attendance,
  loading,
  failed,
  window,
  onRetry,
}: {
  attendance?: GroupAttendanceResponse;
  loading: boolean;
  failed: boolean;
  window: number;
  onRetry: () => void;
}) {
  const t = useTranslations('groups.attendance');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const mobile = useIsMobile();
  const [all, setAll] = useState(false);
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit' });

  const note = (row: Row): string => {
    if (row.hold) return t('hold');
    if (row.risk) {
      return [
        t('risk', { count: row.trailingMisses }),
        row.lastPresentAt ? t('lastCame', { date: day(row.lastPresentAt) }) : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    if (row.misses > 0) {
      const lastMiss = row.cells.lastIndexOf('absent');
      const lesson = attendance?.lessons[lastMiss];
      return [t('missCount', { count: row.misses }), lesson ? day(lesson.startsAtUtc) : null]
        .filter(Boolean)
        .join(' · ');
    }
    return row.cells.includes('present') ? t('noMisses') : t('notMarked');
  };

  const rows: AttendanceListRow[] = (attendance?.rows ?? []).map((row) => {
    const present = row.cells.filter((cell) => cell === 'present').length;
    return {
      id: row.enrollmentId,
      name: row.student.fullName,
      shortName: shortName(row.student.fullName),
      avatarKey: row.student.avatarKey,
      cells: row.cells,
      rate: row.hold || row.rate === null ? '—' : `${Math.round(row.rate * 100)}%`,
      note: note(row),
      cellsLabel: t('cellsLabel', { present, counted: present + row.misses }),
      tone: row.risk ? 'risk' : row.hold ? 'hold' : 'plain',
    };
  });

  const stats = attendance?.stats;
  const improved =
    stats?.rate != null && stats.previousRate != null && stats.rate > stats.previousRate;

  const empty = loading ? (
    <div className="flex flex-col gap-3" role="status" aria-label={tCommon('loading')}>
      <Skeleton className="h-18 w-full rounded-item" />
      <Skeleton className="h-12 w-full rounded-item" />
      <Skeleton className="h-12 w-full rounded-item" />
    </div>
  ) : failed ? (
    <EmptyState
      framed={false}
      minHeight={160}
      title={tCommon('errorTitle')}
      action={
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCcwIcon data-icon="inline-start" />
          {tCommon('retry')}
        </Button>
      }
    />
  ) : !stats || stats.lessons === 0 ? (
    <EmptyState
      framed={false}
      minHeight={160}
      icon={<ClipboardCheckIcon />}
      title={t('emptyTitle')}
      text={t('emptyText')}
    />
  ) : undefined;

  return (
    <AttendanceList
      title={t('title')}
      windowLabel={t('window', { count: window })}
      compact={mobile}
      empty={empty}
      stats={{
        lessons: {
          label: t('lessons'),
          value: stats?.lessons ?? 0,
          note: t('lessonsNote', { count: stats?.held ?? 0 }),
        },
        rate: {
          label: t('rate'),
          value: stats?.rate == null ? '—' : `${Math.round(stats.rate * 100)}%`,
          note: improved ? t('rateNoteImproved') : t('rateNote'),
          good: improved,
        },
        misses: {
          label: t('misses'),
          value: stats?.misses ?? 0,
          note: t('missesNote', { count: stats?.expected ?? 0 }),
          warn: (stats?.misses ?? 0) > 0,
        },
        cancelled: {
          label: t('cancelled'),
          value: stats?.cancelled ?? 0,
          charged: { value: stats?.cancelledCharged ?? 0, label: t('charged') },
          free: { value: stats?.cancelledFree ?? 0, label: t('free') },
        },
      }}
      rows={rows}
      visibleRows={mobile && !all ? PHONE_ROWS : undefined}
      onShowAll={() => setAll(true)}
      showAllLabel={t('showAll', { count: rows.length })}
    />
  );
}
