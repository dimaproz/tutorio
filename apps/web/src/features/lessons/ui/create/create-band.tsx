'use client';

import { useState, type ReactNode } from 'react';
import {
  BanknoteIcon,
  CalendarPlusIcon,
  HourglassIcon,
  PauseIcon,
  RepeatIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useFormContext, useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FieldNote } from '@/components/shared/field-note';
import {
  AvatarStack,
  WhoCard,
  WhoChip,
  WhoEmptyCard,
  WhoTiles,
} from '@/components/shared/who-picker';
import { useGroupsSummaryQuery, useStudentsSummaryQuery } from '../../api';
import type { CreateFormValues } from '../../model/create';
import { packageCoverage } from '../../model/create';
import { useSlotsLabel } from '../field-labels';
import { LessonFormBand } from '../lesson-form-kit';
import { useMoney } from '../lesson-format';
import { GroupSearch, StudentSearch } from './create-search';
import type { CreateData } from './use-create-data';

const firstName = (fullName: string) => fullName.split(' ')[0] ?? fullName;

/**
 * The band of the lesson form (layout B): the header, «Учень / Група» as
 * tiles, and the pick — the dashed empty card, the search in its place, or
 * the picked card with its package, schedule, pause or group chips and
 * «Змінити» — with the note that says what the lessons will cost under it.
 */
export function CreateBand({
  data,
  mobile,
  onClose,
  searchOnOpen = false,
  heading,
}: {
  data: CreateData;
  mobile: boolean;
  onClose: () => void;
  /** Opens the search at once (the "pick a student" state of the stories). */
  searchOnOpen?: boolean;
  /**
   * The schedule form (S05): its own title, icon and subtitle, and «Без
   * розкладу» on a student who has no schedule with the teacher yet.
   */
  heading?: { title: string; subtitle: string; icon: ReactNode; noScheduleChip: string };
}) {
  const t = useTranslations('lessons.create');
  const tLevel = useTranslations('languageLevel');
  const tValidation = useTranslations('validation');
  const format = useFormatter();
  const money = useMoney();
  const slots = useSlotsLabel();
  const form = useFormContext<CreateFormValues>();
  const [who, studentId, groupId, frequency, dates] = useWatch({
    control: form.control,
    name: ['who', 'studentId', 'groupId', 'frequency', 'dates'],
  });
  const [searching, setSearching] = useState(searchOnOpen);
  const studentsSummary = useStudentsSummaryQuery();
  const groupsSummary = useGroupsSummaryQuery();
  const errors = form.formState.errors;

  const picked = who === 'student' ? studentId : groupId;
  const subtitle = !picked
    ? t('subtitleEmpty')
    : who === 'student'
      ? t('subtitleIndividual')
      : t('subtitleGroup');

  const pick = (field: 'studentId' | 'groupId', id: string) => {
    form.setValue(field, id, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    setSearching(false);
  };

  const change = (
    <Button
      type="button"
      variant={mobile ? 'ghost' : 'outline'}
      size="sm"
      onClick={() => setSearching(true)}
    >
      {t('change')}
    </Button>
  );

  const scheduleChip = data.schedule ? (
    <WhoChip icon={<RepeatIcon />}>{slots(data.schedule.slots, { short: true })}</WhoChip>
  ) : heading && who === 'student' && data.booking ? (
    <WhoChip icon={<RepeatIcon />}>{heading.noScheduleChip}</WhoChip>
  ) : null;

  let body;
  let note = null;
  if (searching) {
    body =
      who === 'student' ? (
        <StudentSearch
          mobile={mobile}
          onPick={(id) => pick('studentId', id)}
          onClose={() => setSearching(false)}
        />
      ) : (
        <GroupSearch onPick={(id) => pick('groupId', id)} onClose={() => setSearching(false)} />
      );
  } else if (who === 'student' && data.student) {
    const student = data.student;
    // Phones keep the meta short: the level's code only ("B2").
    const level = student.languageLevel
      ? mobile
        ? student.languageLevel
        : tLevel(student.languageLevel)
      : null;
    const teacher = data.primary?.teacher.name;
    const meta = teacher
      ? level
        ? t('studentMeta', { level, teacher })
        : t('studentMetaNoLevel', { teacher })
      : t('studentMetaNew');
    const pause = data.studentPause;
    const pauseDate = pause?.endsAt
      ? format.dateTime(new Date(pause.endsAt), { day: 'numeric', month: 'long' })
      : null;
    const credits = data.credits;
    const chips = (
      <>
        {pause || student.status === 'ON_HOLD' ? (
          <Badge variant="warning" dot>
            {pauseDate ? t('chipPaused', { date: pauseDate }) : t('chipPausedOpen')}
          </Badge>
        ) : null}
        {credits && credits.total !== null ? (
          <span className="inline-flex h-6.5 items-center rounded-pill bg-background px-2.5">
            <CreditMeter
              inline
              left={credits.left}
              total={credits.total}
              lowThreshold={1}
              label={t('chipPackage', { left: credits.left, total: credits.total })}
            />
          </span>
        ) : null}
        {data.booking && data.booking.priceMode === 'amount' && !pause ? (
          <>
            <Badge variant="indigo">{t('chipNoPackage')}</Badge>
            <Badge variant="indigo">
              {t('chipOneOff', {
                price: money(data.booking.rateMinor, data.booking.currency),
              })}
            </Badge>
          </>
        ) : null}
        {scheduleChip}
      </>
    );
    body = (
      <WhoCard
        media={
          <EntityAvatar
            avatarKey={student.avatarKey}
            fullName={student.fullName}
            size={mobile ? 'md' : 'lg'}
          />
        }
        name={student.fullName}
        meta={meta}
        chips={chips}
        action={change}
      />
    );
    const count = frequency === 'once' ? dates.length : 1;
    if (pause) {
      note = (
        <FieldNote tone="brand" icon={<PauseIcon />}>
          {t('notePaused', { name: firstName(student.fullName) })}
        </FieldNote>
      );
    } else if (credits && frequency === 'once') {
      const coverage = packageCoverage(count, credits.left);
      if (coverage.debt > 0) {
        note = (
          <FieldNote tone="brand" icon={<HourglassIcon />}>
            {coverage.covered > 0
              ? t('noteRunningOut', { covered: coverage.covered })
              : t('noteNoCredits')}
          </FieldNote>
        );
      }
    } else if (data.booking?.priceMode === 'amount' && data.booking.direction) {
      note = (
        <FieldNote tone="brand" icon={<BanknoteIcon />}>
          {t('noteNoPackage')}
        </FieldNote>
      );
    }
  } else if (who === 'group' && data.group) {
    const booking = data.group;
    const schedule = data.schedule ? slots(data.schedule.slots) : null;
    const teacher = booking.group.teacher?.name ?? '';
    body = (
      <WhoCard
        media={
          <AvatarStack
            people={booking.members.map((member) => member.student)}
            max={3}
            size={mobile ? 'sm' : 'md'}
          />
        }
        name={booking.group.name}
        meta={schedule ? t('groupMeta', { schedule, teacher }) : teacher}
        chips={
          <>
            <Badge
              variant="indigo"
              aria-label={t('chipMembers', { count: booking.members.length })}
            >
              <UsersIcon data-icon="inline-start" />
              {booking.members.length}
            </Badge>
            {booking.paused.length > 0 ? (
              // Compact, so the chips keep to one line; the name says it all.
              <Badge
                variant="warning"
                aria-label={t('chipPausedMembers', { count: booking.paused.length })}
              >
                <PauseIcon data-icon="inline-start" />
                {booking.paused.length}
              </Badge>
            ) : null}
            <GroupPricePill
              price={t('chipPerMember', { price: money(booking.rateMinor, booking.currency) })}
              own={
                booking.ownPrices.length > 0
                  ? {
                      label: t('chipOwnPrices', { count: booking.ownPrices.length }),
                      names: booking.ownPrices
                        .map((item) =>
                          t('ownPriceOf', {
                            name: item.name,
                            price: money(item.priceMinor, item.currency),
                          }),
                        )
                        .join(', '),
                    }
                  : null
              }
            />
          </>
        }
        action={change}
      />
    );
  } else {
    body = (
      <WhoEmptyCard
        title={who === 'student' ? t('pickStudent') : t('pickGroup')}
        hint={
          who === 'student'
            ? studentsSummary.data
              ? t('pickStudentHint', { count: studentsSummary.data.all })
              : undefined
            : groupsSummary.data
              ? t('pickGroupHint', { count: groupsSummary.data.total })
              : undefined
        }
        error={
          who === 'student'
            ? errors.studentId
              ? tValidation('lessonStudentRequired')
              : undefined
            : errors.groupId
              ? tValidation('lessonGroupRequired')
              : undefined
        }
        onOpen={() => setSearching(true)}
      />
    );
  }

  return (
    <LessonFormBand
      icon={heading?.icon ?? <CalendarPlusIcon />}
      title={heading?.title ?? t('title')}
      subtitle={heading?.subtitle ?? subtitle}
      mobile={mobile}
      onClose={onClose}
    >
      <WhoTiles
        label={t('whoLabel')}
        value={who}
        onValueChange={(next) => {
          if (next === who) return;
          // Switching between a student and a group resets the pick.
          form.setValue('who', next);
          form.setValue('studentId', '');
          form.setValue('groupId', '');
          form.setValue('cancelledBy', next === 'group' ? 'GROUP' : 'STUDENT');
          if (form.getValues('pastStatus') === 'NO_SHOW' && next === 'group') {
            form.setValue('pastStatus', 'COMPLETED');
          }
          setSearching(false);
        }}
        options={[
          {
            value: 'student',
            title: t('student'),
            hint: t('studentHint'),
            icon: <UserRoundIcon />,
          },
          { value: 'group', title: t('group'), hint: t('groupHint'), icon: <UsersIcon /> },
        ]}
      />
      {body}
      {note}
    </LessonFormBand>
  );
}

/**
 * The group card's price: «400 ₴ з учасника», and when some members pay their
 * own price (L-11), «│ 1 зі своєю» in the same pill, whose tooltip names them.
 */
function GroupPricePill({
  price,
  own,
}: {
  price: string;
  own: { label: string; names: string } | null;
}) {
  const [open, setOpen] = useState(false);
  if (!own) return <Badge variant="indigo">{price}</Badge>;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <Badge variant="indigo" asChild>
          <button type="button" aria-label={`${price}, ${own.names}`} onClick={() => setOpen(true)}>
            {price}
            <span aria-hidden="true" className="h-3 w-px bg-current opacity-30" />
            <span className="font-medium opacity-80">{own.label}</span>
          </button>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{own.names}</TooltipContent>
    </Tooltip>
  );
}
