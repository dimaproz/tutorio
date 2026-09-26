'use client';

import { useState } from 'react';
import {
  ArchiveIcon,
  CalendarDaysIcon,
  EyeOffIcon,
  GraduationCapIcon,
  HistoryIcon,
  InfoIcon,
  RepeatIcon,
  UsersIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TeacherResponse } from '@tutorio/validation';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { FieldNote } from '@/components/shared/field-note';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ConflictPairs, scheduleConflicts } from '@/features/lessons';
import { useIsMobile } from '@/hooks/use-mobile';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useArchiveTeacherMutation,
  useTeacherArchivePreviewQuery,
  useTeachersQuery,
} from '@/lib/api/teachers';
import type { GatewayError } from '@/lib/auth/client';

/** The picker's «Не передавати»: Radix and the picker need a non-empty value. */
const KEEP = '__keep';

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

/**
 * Archive a teacher, or — on the owner's own profile — turn teaching off
 * (S09 boards 02-04 and 02-05). It says what happens to the future lessons,
 * the schedules and the history, and asks who takes the future lessons over:
 * another active teacher or «Не передавати». The new teacher's overlaps are
 * checked as soon as one is picked and shown with «Все одно передати» (L-110,
 * L-111). A bottom sheet on phones.
 */
export function TeacherArchiveDialog({
  teacher,
  open,
  onOpenChange,
  onDone,
}: {
  teacher: TeacherResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  return open ? (
    <ArchiveFlow teacher={teacher} onOpenChange={onOpenChange} onDone={onDone} />
  ) : null;
}

function ArchiveFlow({
  teacher,
  onOpenChange,
  onDone,
}: {
  teacher: TeacherResponse;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const t = useTranslations('teachers.archive');
  const tToasts = useTranslations('teachers.toasts');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const mobile = useIsMobile();
  const own = teacher.isMe;
  const teachers = useTeachersQuery({ page: 1, pageSize: 100, status: 'ACTIVE' });
  const others = (teachers.data?.items ?? []).filter((item) => item.id !== teacher.id);
  // Handing over is the default when someone can take the lessons (the
  // boards): a colleague first, the owner only when nobody else teaches.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const fallback = others.find((item) => !item.isMe) ?? others[0];
  const transferTo = picked === undefined ? (fallback?.id ?? null) : picked;
  const target = others.find((item) => item.id === transferTo) ?? null;
  const preview = useTeacherArchivePreviewQuery(teacher.id, transferTo, teachers.isSuccess);
  const archive = useArchiveTeacherMutation(teacher.id);
  const data = preview.data;
  const conflicts = target && data ? data.conflicts : [];
  const hasWork = Boolean(data && (data.futureLessonCount > 0 || data.scheduleCount > 0));
  const busy = archive.isPending;
  const name = firstName(teacher.fullName);

  const until = data?.lastLessonAt
    ? format.dateTime(new Date(data.lastLessonAt), { day: 'numeric', month: 'long' })
    : '';
  const items: ImpactItem[] = [];
  if (data && !hasWork) {
    items.push({
      id: 'nothing',
      icon: <CalendarDaysIcon />,
      tone: 'neutral',
      title: t('nothing'),
      text: t('nothingText'),
    });
  } else if (data && own) {
    items.push({
      id: 'lessons',
      icon: <CalendarDaysIcon />,
      tone: 'warning',
      title: t('ownLessons', { lessons: data.futureLessonCount, schedules: data.scheduleCount }),
      text: until ? t('ownLessonsText', { date: until, students: data.studentCount }) : undefined,
    });
  } else if (data) {
    if (data.scheduleCount > 0) {
      items.push(
        target
          ? {
              id: 'schedules',
              icon: <RepeatIcon />,
              tone: 'info',
              title: t('schedulesMove', {
                count: data.scheduleCount,
                name: firstName(target.fullName),
              }),
              text: t('schedulesMoveText', { name: firstName(target.fullName) }),
            }
          : {
              id: 'schedules',
              icon: <RepeatIcon />,
              tone: 'warning',
              title: t('schedulesStay', { count: data.scheduleCount, name }),
              text: t('schedulesStayText'),
            },
      );
    }
    if (data.futureLessonCount > 0) {
      items.push({
        id: 'lessons',
        icon: <CalendarDaysIcon />,
        tone: 'warning',
        title: t('lessons', { count: data.futureLessonCount }),
        text: until
          ? t('lessonsText', {
              date: until,
              students: data.studentCount,
              groups: data.groups.length,
            })
          : undefined,
      });
    }
  }
  // One-to-one students move with their billing (the owner's answer,
  // 2026-09-26), except those who already study with the new teacher.
  if (data && target && data.directionCount > 0) {
    const to = firstName(target.fullName);
    items.push({
      id: 'directions',
      icon: <UsersIcon />,
      tone: 'info',
      title: t('directions', { count: data.directionCount - data.keptDirectionCount, name: to }),
      text:
        data.keptDirectionCount > 0
          ? t('directionsKept', { kept: data.keptDirectionCount, name: to })
          : t('directionsText'),
    });
  }
  if (own) {
    items.push({
      id: 'hidden',
      icon: <EyeOffIcon />,
      tone: 'neutral',
      title: t('hidden'),
      text: t('hiddenText'),
    });
  }
  items.push({
    id: 'history',
    icon: <HistoryIcon />,
    tone: 'neutral',
    title: t('history'),
    text: own ? t('ownHistoryText') : t('historyText'),
  });

  const options: EntityPickerOption[] = [
    { value: KEEP, label: t('transferNone'), description: t('transferNoneDescription') },
    ...others.map((item) => ({
      value: item.id,
      label: item.fullName,
      avatarKey: item.avatarKey,
      description: item.subjects.join(' · ') || undefined,
    })),
  ];

  const submit = async (force: boolean) => {
    try {
      await archive.mutateAsync({ transferTo, force });
      const handedTo = target?.fullName;
      toast.success(
        own
          ? handedTo
            ? tToasts('teachingOffTransferred', { to: handedTo })
            : tToasts('teachingOff')
          : handedTo
            ? tToasts('archivedTransferred', { name: teacher.fullName, to: handedTo })
            : tToasts('archived', { name: teacher.fullName }),
      );
      onOpenChange(false);
      onDone?.();
    } catch (error) {
      // A lesson booked since the check: read the overlaps again.
      if (scheduleConflicts(error)) void preview.refetch();
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  };

  const forced = conflicts.length > 0;
  const primaryLabel = forced
    ? t('force')
    : own
      ? target && hasWork
        ? t('ownSubmitTransfer')
        : t('ownSubmit')
      : target && hasWork
        ? t('submitTransfer')
        : t('submit');

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => !busy && onOpenChange(next)}
      icon={own ? <GraduationCapIcon /> : <ArchiveIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={own ? t('ownTitle') : t('title', { name: teacher.fullName })}
      description={own ? t('ownDescription', { name: teacher.fullName }) : t('description')}
      closeLabel={t('close')}
      size="lg"
      primary={
        <Button
          type="button"
          size={mobile ? 'xl' : 'default'}
          disabled={busy || preview.isPending || preview.isFetching}
          onClick={() => void submit(forced)}
        >
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {primaryLabel}
        </Button>
      }
      secondary={
        <Button
          type="button"
          variant="outline"
          size={mobile ? 'xl' : 'default'}
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
      }
      tertiary={
        <FieldNote icon={<InfoIcon />} tone="muted">
          {own ? t('ownFootnote') : t('footnote')}
        </FieldNote>
      }
    >
      <div className="flex flex-col gap-5">
        {data ? (
          <ImpactList items={items} label={t('consequences')} />
        ) : (
          <Skeleton className="h-44 w-full rounded-tile" />
        )}
        {hasWork || !data ? (
          <div className="flex flex-col gap-2">
            <span id="teacher-transfer-label" className="text-sm font-medium">
              {own ? t('ownTransferLabel') : t('transferLabel')}
            </span>
            <EntityPicker
              aria-label={own ? t('ownTransferLabel') : t('transferLabel')}
              appearance="field"
              value={transferTo ?? KEEP}
              onChange={(next) => setPicked(!next || next === KEEP ? null : next)}
              options={options}
              placeholder={t('transferNone')}
              searchPlaceholder={t('transferSearch')}
              emptyLabel={t('transferEmpty')}
              isLoading={teachers.isPending}
              disabled={busy}
            />
            <span className="text-[13px] text-muted-foreground">
              {target
                ? preview.isFetching
                  ? t('checking')
                  : forced
                    ? t('transferHint')
                    : t('free')
                : t('transferHint')}
            </span>
          </div>
        ) : null}
        {forced && target ? (
          <ConflictPairs
            conflicts={conflicts}
            durationMin={conflicts[0]!.durationMin}
            title={teacher.fullName}
            newLabel={t('conflictsNew')}
            mobile={mobile}
            heading={t('conflictsHeading', {
              count: new Set(conflicts.map((item) => item.candidateStartsAtUtc)).size,
              name: firstName(target.fullName),
            })}
            explanation={t('conflictsText')}
          />
        ) : null}
      </div>
    </AdaptiveDialog>
  );
}
