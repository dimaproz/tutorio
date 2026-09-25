'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { LessonPanelIntent } from '@/features/lessons';
import { needsMakeup, paymentView, type PackageState } from '../model/payment';
import {
  PaymentCell,
  PriceCell,
  StatusCell,
  TeacherCell,
  useLessonWhen,
  WhoCell,
  type ListLesson,
} from './lesson-cells';
import { LessonRowMenu } from './lesson-row-menu';

/** Date and time, who, teacher, status, payment, price, menu; solo drops the teacher. */
export function lessonsRowLayout(solo: boolean) {
  return solo
    ? '150px minmax(0,1.6fr) minmax(0,1.3fr) minmax(0,1.3fr) 90px 36px'
    : '150px minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.05fr) minmax(0,1fr) 90px 36px';
}

/**
 * The Lessons table's columns (S04 decision 5). The time is the row's one
 * button: it stretches over the row and opens the S01 panel, while the
 * «Призначити» button and the menu stay clickable above it.
 */
export function useLessonsColumns({
  solo,
  now,
  quick,
  teacherAvatars,
  packageOf,
  onOpen,
}: {
  solo: boolean;
  now: number;
  quick: string;
  teacherAvatars: Map<string, string | null>;
  /** The package the lesson's direction pays with now. */
  packageOf: (lesson: ListLesson) => PackageState | null;
  onOpen: (lessonId: string, intent?: LessonPanelIntent) => void;
}) {
  const t = useTranslations('lessonList');
  const when = useLessonWhen();
  return useMemo<ColumnDef<ListLesson, unknown>[]>(() => {
    const columns: ColumnDef<ListLesson, unknown>[] = [
      {
        id: 'when',
        header: () => t('columns.when'),
        cell: ({ row }) => {
          const { range, day } = when(row.original);
          return (
            <div className="flex min-w-0 flex-col">
              <button
                type="button"
                onClick={() => onOpen(row.original.id)}
                aria-label={t('openLesson', {
                  when: `${day}, ${range}`,
                  who: row.original.group?.name ?? row.original.student?.fullName ?? '',
                })}
                className="text-left text-[15px] leading-5 font-semibold tabular-nums outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
              >
                {range}
              </button>
              <span className="text-[13px] leading-[18px] text-muted-foreground">{day}</span>
            </div>
          );
        },
      },
      {
        id: 'who',
        header: () => t('columns.who'),
        cell: ({ row }) => <WhoCell lesson={row.original} />,
      },
      ...(solo
        ? []
        : [
            {
              id: 'teacher',
              header: () => t('columns.teacher'),
              cell: ({ row }) => (
                <TeacherCell
                  name={row.original.teacher.name}
                  avatarKey={teacherAvatars.get(row.original.teacher.id)}
                />
              ),
            } satisfies ColumnDef<ListLesson, unknown>,
          ]),
      {
        id: 'status',
        header: () => t('columns.status'),
        cell: ({ row }) => <StatusCell lesson={row.original} />,
      },
      {
        id: 'payment',
        header: () => t('columns.payment'),
        cell: ({ row }) =>
          quick === 'needs_makeup' && needsMakeup(row.original) ? (
            <Button
              type="button"
              variant="outline"
              className="relative z-10"
              onClick={() => onOpen(row.original.id, 'makeup')}
            >
              <RepeatIcon data-icon="inline-start" />
              {t('assign')}
            </Button>
          ) : (
            <PaymentCell view={paymentView(row.original, packageOf(row.original))} />
          ),
      },
      {
        id: 'price',
        header: () => <span className="block text-right">{t('columns.price')}</span>,
        cell: ({ row }) => <PriceCell lesson={row.original} />,
      },
      {
        id: 'menu',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="relative z-10 flex justify-end">
            <LessonRowMenu lesson={row.original} now={now} onOpen={onOpen} />
          </div>
        ),
      },
    ];
    return columns;
  }, [now, onOpen, packageOf, quick, solo, t, teacherAvatars, when]);
}
