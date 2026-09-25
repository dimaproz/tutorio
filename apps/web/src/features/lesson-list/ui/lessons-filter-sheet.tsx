'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { enUS, uk } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DateField } from '@/components/shared/date-field';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Segmented } from '@/components/shared/segmented';
import { zonedDate } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useLessonPageQuery } from '../api';
import { listQuery, periodRange, type LessonListState, type StatusOption } from '../model/filters';
import { WhoPicker, type TeacherOption, type WhoValue } from './people-menus';
import { StatusChecks } from './status-menu';

const ALL = '__all';

function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-3 pb-1 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

type Draft = Pick<
  LessonListState,
  'period' | 'from' | 'to' | 'teacherId' | 'studentId' | 'groupId' | 'statuses'
>;

/**
 * The phone's filters (S04 phone board 03): the period (week, month or own
 * dates), the teacher, the student or group, the statuses; «Скинути» and
 * «Показати N занять», which counts the draft before applying it.
 */
export function LessonsFilterSheet({
  open,
  onOpenChange,
  state,
  now,
  solo,
  teachers,
  whoName,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LessonListState;
  now: number;
  solo: boolean;
  teachers: readonly TeacherOption[];
  whoName: string | null;
  onApply: (draft: Draft) => void;
}) {
  const t = useTranslations('lessonList.sheet');
  const tPeriods = useTranslations('lessonList.periods');
  const tFields = useTranslations('lessons.fields');
  const format = useLocalFormatter();
  const locale = useLocale();
  const timeZone = useStudioTimeZone();
  const [draft, setDraft] = useState<Draft>(state);
  const [draftName, setDraftName] = useState(whoName);
  const count = useLessonPageQuery(
    { ...listQuery({ ...state, ...draft, page: 1 }, now, timeZone), pageSize: 1, page: 1 },
    open,
  );
  const range = periodRange(draft, now, timeZone);
  const kind = draft.period === 'week' || draft.period === 'month' ? draft.period : 'custom';
  const who: WhoValue | null = draft.studentId
    ? { kind: 'student', id: draft.studentId }
    : draft.groupId
      ? { kind: 'group', id: draft.groupId }
      : null;
  const fieldFormat = (date: Date) =>
    format.dateTime(date, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(state);
          setDraftName(whoName);
        }
        onOpenChange(next);
      }}
    >
      <DrawerContent>
        <DrawerHeader className="flex-row items-center justify-between px-5 pt-5 pb-0">
          <DrawerTitle className="text-xl leading-7 font-semibold">{t('title')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('description')}</DrawerDescription>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setDraft({
                period: 'month',
                from: null,
                to: null,
                teacherId: null,
                studentId: null,
                groupId: null,
                statuses: [],
              })
            }
          >
            {t('reset')}
          </Button>
        </DrawerHeader>
        <div className="scrollbar-thin flex min-h-0 flex-col gap-1 overflow-y-auto px-5 pt-2">
          <SheetHeading>{t('period')}</SheetHeading>
          <Segmented
            label={t('period')}
            variant="paper"
            className="self-start"
            value={kind}
            onValueChange={(next) => {
              if (next === 'custom') {
                const today = zonedDate(now, timeZone);
                update({ period: 'custom', from: today, to: today });
              } else update({ period: next, from: null, to: null });
            }}
            items={[
              { value: 'week', label: tPeriods('weekShort') },
              { value: 'month', label: tPeriods('monthShort') },
              { value: 'custom', label: tPeriods('customShort') },
            ]}
          />
          {kind === 'custom' && range ? (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <DateField
                aria-label={tPeriods('from')}
                value={draft.from ?? ''}
                onValueChange={(from) =>
                  update({ from, to: draft.to && draft.to >= from ? draft.to : from })
                }
                formatValue={fieldFormat}
                placeholder={tFields('pickDate')}
                locale={locale === 'uk' ? uk : enUS}
              />
              <DateField
                aria-label={tPeriods('to')}
                value={draft.to ?? ''}
                onValueChange={(to) =>
                  update({ to, from: draft.from && draft.from <= to ? draft.from : to })
                }
                formatValue={fieldFormat}
                placeholder={tFields('pickDate')}
                locale={locale === 'uk' ? uk : enUS}
              />
            </div>
          ) : null}

          {solo ? null : (
            <>
              <SheetHeading>{t('teacher')}</SheetHeading>
              <RadioGroup
                aria-label={t('teacher')}
                value={draft.teacherId ?? ALL}
                onValueChange={(next) => update({ teacherId: next === ALL ? null : next })}
                className="gap-0"
              >
                {[{ id: ALL, fullName: t('allTeachers'), avatarKey: null }, ...teachers].map(
                  (teacher) => (
                    <div key={teacher.id} className="flex min-h-13 items-center gap-3">
                      <RadioGroupItem id={`sheet-teacher-${teacher.id}`} value={teacher.id} />
                      {teacher.id === ALL ? null : (
                        <EntityAvatar
                          avatarKey={teacher.avatarKey}
                          fullName={teacher.fullName}
                          size="xs"
                          tint="paper"
                        />
                      )}
                      <Label
                        htmlFor={`sheet-teacher-${teacher.id}`}
                        className="grow text-[15px] leading-5 font-normal"
                      >
                        {teacher.fullName}
                      </Label>
                    </div>
                  ),
                )}
              </RadioGroup>
            </>
          )}

          <Label className="pt-3 pb-1 text-sm leading-5 font-medium">{t('who')}</Label>
          <WhoPicker
            appearance="field"
            selected={who}
            name={draftName}
            onChange={(next, name) => {
              setDraftName(name);
              update({
                studentId: next?.kind === 'student' ? next.id : null,
                groupId: next?.kind === 'group' ? next.id : null,
              });
            }}
          />

          <SheetHeading>{t('status')}</SheetHeading>
          <StatusChecks
            value={draft.statuses}
            onChange={(statuses: StatusOption[]) => update({ statuses })}
            idPrefix="status-sheet"
          />
        </div>
        <DrawerFooter className="px-5 pt-4">
          <Button
            type="button"
            size="xl"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            {count.data ? t('show', { count: count.data.total }) : t('showPending')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
