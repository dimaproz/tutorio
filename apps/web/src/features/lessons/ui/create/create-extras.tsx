'use client';

import type { ReactNode } from 'react';
import {
  CalendarPlusIcon,
  CircleCheckIcon,
  CircleXIcon,
  HistoryIcon,
  RepeatIcon,
  TriangleAlertIcon,
  UsersIcon,
  UserXIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useFormContext, useWatch } from 'react-hook-form';
import type {
  ScheduleChangePreview,
  ScheduleCreatePreview,
  ScheduleSlotDto,
} from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { Notice } from '@/components/shared/notice';
import { Segmented } from '@/components/shared/segmented';
import { pastRows, type CreateFormValues, type PastStatus } from '../../model/create';
import { useFormDates, useSlotsLabel } from '../field-labels';

function Overline({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/**
 * A date in the past (L-31): the indigo callout and «Як пройшло заняття» —
 * held (default), cancelled (then who cancelled and whether to charge it) or,
 * for a student, a no-show.
 */
export function CreatePast({ now, group }: { now: number; group: boolean }) {
  const t = useTranslations('lessons.create');
  const form = useFormContext<CreateFormValues>();
  const formDates = useFormDates();
  const [frequency, dates, pastStatus, cancelledBy, cancelCharge] = useWatch({
    control: form.control,
    name: ['frequency', 'dates', 'pastStatus', 'cancelledBy', 'cancelCharge'],
  });
  if (frequency !== 'once') return null;
  const past = pastRows({ dates }, now);
  const first = dates.findIndex((_, index) => past[index]);
  if (first < 0) return null;
  const many = past.filter(Boolean).length > 1;

  const options = [
    {
      value: 'COMPLETED' as PastStatus,
      title: t('pastHeld'),
      hint: t('pastHeldHint'),
      icon: <CircleCheckIcon />,
    },
    {
      value: 'CANCELLED' as PastStatus,
      title: t('pastCancelled'),
      hint: t('pastCancelledHint'),
      icon: <CircleXIcon />,
    },
    ...(group
      ? []
      : [
          {
            value: 'NO_SHOW' as PastStatus,
            title: t('pastNoShow'),
            hint: t('pastNoShowHint'),
            icon: <UserXIcon />,
          },
        ]),
  ];

  return (
    <section className="flex flex-col gap-3">
      <Notice
        appearance="callout"
        tone="indigo"
        icon={<HistoryIcon />}
        title={
          many
            ? t('pastTitleMany')
            : t('pastTitle', { date: formDates.dayMonth(dates[first]!.date) })
        }
        text={t('pastText')}
      />
      <ChoiceCardGroup
        label={t('pastChoice')}
        value={pastStatus}
        onValueChange={(next) => form.setValue('pastStatus', next, { shouldDirty: true })}
        options={options}
      />
      {pastStatus === 'CANCELLED' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            variant="paper"
            label={t('cancelledBy')}
            value={cancelledBy}
            onValueChange={(next) => form.setValue('cancelledBy', next, { shouldDirty: true })}
            items={[
              group
                ? { value: 'GROUP' as const, label: t('groupCancelledBy') }
                : { value: 'STUDENT' as const, label: t('cancelledByStudent') },
              { value: 'TEACHER' as const, label: t('cancelledByTeacher') },
            ]}
          />
          <Segmented
            variant="paper"
            label={t('cancelCharge')}
            value={cancelCharge}
            onValueChange={(next) => form.setValue('cancelCharge', next, { shouldDirty: true })}
            items={[
              { value: 'charge' as const, label: t('cancelCharge') },
              { value: 'free' as const, label: t('cancelFree') },
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}

/** A group lesson with paused members: «Візьмуть участь 5 з 6» and who is left out (L-3). */
export function CreateParticipants({
  total,
  paused,
}: {
  total: number;
  paused: { name: string; endsAt: string | null }[];
}) {
  const t = useTranslations('lessons.create');
  const format = useFormatter();
  if (paused.length === 0) return null;
  const one = paused[0]!;
  const text =
    paused.length > 1
      ? t('participantsPausedMany', { count: paused.length })
      : one.endsAt
        ? t('participantsPausedOne', {
            name: one.name,
            date: format.dateTime(new Date(one.endsAt), { day: 'numeric', month: 'long' }),
          })
        : t('participantsPausedOneOpen', { name: one.name });
  return (
    <Notice
      appearance="callout"
      tone="neutral"
      icon={<UsersIcon />}
      title={t('participantsTitle', { count: total - paused.length, total })}
      text={text}
    />
  );
}

/** «Зараз → Стане»: the schedule's days now and with the picked ones added (L-23). */
function NowBecomes({
  now,
  becomes,
}: {
  now: readonly ScheduleSlotDto[];
  becomes: readonly ScheduleSlotDto[];
}) {
  const t = useTranslations('lessons.create');
  const slots = useSlotsLabel();
  const chip = (slot: ScheduleSlotDto, added: boolean) => (
    <Badge
      key={`${slot.weekday}-${slot.localTime}`}
      variant={added ? 'brand' : 'neutral'}
      size="lg"
    >
      {slots([slot], { short: true })}
    </Badge>
  );
  const isNew = (slot: ScheduleSlotDto) =>
    !now.some((item) => item.weekday === slot.weekday && item.localTime === slot.localTime);
  return (
    <div className="grid grid-cols-2 gap-3 rounded-tile border border-border px-4 py-3">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
          {t('now')}
        </span>
        <div className="flex flex-wrap gap-1.5">{now.map((slot) => chip(slot, false))}</div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
          {t('becomes')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {becomes.map((slot) => chip(slot, isNew(slot)))}
        </div>
      </div>
    </div>
  );
}

/** «Конфліктів немає», or how many lessons overlap (L-110), from a preview. */
function useConflictsItem() {
  const t = useTranslations('lessons.create');
  return (count: number): ImpactItem =>
    count > 0
      ? {
          id: 'conflicts',
          icon: <TriangleAlertIcon />,
          tone: 'warning',
          title: t('impactConflicts', { count }),
          text: t('impactConflictsText'),
        }
      : {
          id: 'conflicts',
          icon: <CircleCheckIcon />,
          tone: 'success',
          title: t('impactNoConflicts'),
        };
}

/**
 * «Що буде» of «Щотижня». A new schedule: the schedule, how many lessons it
 * creates within the horizon (L-22) and what they overlap, from its preview
 * (the count is worked out locally until the preview arrives). Days added to
 * an existing schedule: the callout, «Зараз → Стане», and the change
 * preview's numbers and conflicts (L-25). The save still checks again (L-111).
 */
export function CreateWeeklyImpact({
  existing,
  added,
  becomes,
  preview,
  previewPending,
  createPreview,
  newCount,
  horizonWeeks,
  who,
  teacher,
  ownerName,
}: {
  existing: readonly ScheduleSlotDto[] | null;
  added: readonly ScheduleSlotDto[];
  becomes: readonly ScheduleSlotDto[];
  preview: ScheduleChangePreview | undefined;
  previewPending: boolean;
  /** A new schedule's preview, once it arrives. */
  createPreview: ScheduleCreatePreview | undefined;
  newCount: number;
  horizonWeeks: number;
  /** The student's or the group's name. */
  who: { name: string; group: boolean };
  teacher: string;
  /** The student's first name, for «У Anna вже є розклад». */
  ownerName: string;
}) {
  const t = useTranslations('lessons.create');
  const form = useFormContext<CreateFormValues>();
  const formDates = useFormDates();
  const slots = useSlotsLabel();
  const conflictsItem = useConflictsItem();
  const [from, until] = useWatch({ control: form.control, name: ['from', 'until'] });
  if (added.length === 0) return null;

  if (!existing) {
    const fromLabel = formDates.dayMonth(from);
    const text = who.group
      ? until
        ? t('impactNewGroupTextUntil', {
            from: fromLabel,
            until: formDates.dayMonth(until),
            who: who.name,
          })
        : t('impactNewGroupText', { from: fromLabel, who: who.name })
      : until
        ? t('impactNewTextUntil', {
            from: fromLabel,
            until: formDates.dayMonth(until),
            who: who.name,
            teacher,
          })
        : t('impactNewText', { from: fromLabel, who: who.name, teacher });
    const items: ImpactItem[] = [
      {
        id: 'schedule',
        icon: <RepeatIcon />,
        tone: 'indigo',
        title: t('impactNew', { slots: slots(added) ?? '' }),
        text,
      },
      {
        id: 'create',
        icon: <CalendarPlusIcon />,
        tone: 'info',
        title: t('impactCreate', {
          count: createPreview?.created ?? newCount,
          weeks: horizonWeeks,
        }),
        text: t('impactCreateText'),
      },
      ...(createPreview ? [conflictsItem(createPreview.conflicts.length)] : []),
    ];
    return (
      <section className="flex flex-col gap-3">
        <Overline>{t('impact')}</Overline>
        <ImpactList items={items} />
      </section>
    );
  }

  const items: ImpactItem[] = [];
  if (preview) {
    items.push({
      id: 'add',
      icon: <CalendarPlusIcon />,
      tone: 'info',
      title: t('impactAdd', { count: preview.created, days: slots(added) ?? '' }),
      text: t('impactAddText'),
    });
    if (preview.moved > 0) {
      items.push({
        id: 'moved',
        icon: <RepeatIcon />,
        tone: 'indigo',
        title: t('impactMoved', { count: preview.moved }),
      });
    }
    items.push(conflictsItem(preview.conflicts.length));
  }

  return (
    <section className="flex flex-col gap-3">
      <Notice
        appearance="callout"
        tone="indigo"
        icon={<RepeatIcon />}
        title={
          who.group ? t('existingTitleGroup') : t('existingTitle', { name: ownerName, teacher })
        }
        text={t('existingText', { slots: slots(existing) ?? '', days: slots(added) ?? '' })}
      />
      <NowBecomes now={existing} becomes={becomes} />
      {previewPending ? (
        <Skeleton aria-label={t('impactLoading')} className="h-30 w-full rounded-tile" />
      ) : items.length > 0 ? (
        <ImpactList items={items} label={t('impact')} />
      ) : null}
    </section>
  );
}
