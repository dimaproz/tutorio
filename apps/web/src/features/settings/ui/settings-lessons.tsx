'use client';

import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Controller } from 'react-hook-form';
import { useSession } from '@/components/app/session-provider';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { Separator } from '@/components/ui/separator';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  lessonSettingsDefaults,
  lessonSettingsSchema,
  SETTING_NUMBERS,
  type LessonSettingsValues,
} from '../model/form';
import { CancellationExplainer, HorizonExplainer, LowCreditExplainer } from './lesson-explainers';
import { SettingHeading, SettingsFrame } from './settings-frame';
import { SettingStepper } from './setting-stepper';
import { useSettingsForm } from './use-settings-form';

type Key = keyof LessonSettingsValues;

/** One setting: label, hint, stepper and presets on the left; its picture on the right. */
function SettingRow({ controls, picture }: { controls: ReactNode; picture: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-4">{controls}</div>
      <div className="min-w-0">{picture}</div>
    </div>
  );
}

/**
 * «Заняття й пакети» (`/app/settings/lessons`, S10 board 03): the free
 * cancellation window (L-51), how far ahead new schedules book (L-120) and
 * when a package warns it is running low (L-82; 0 turns it off). Each number
 * explains itself with a picture of what it does; the page saves on its own.
 */
export function SettingsLessonsPage() {
  const t = useTranslations('settings.lessons');
  const tUnits = useTranslations('settings.units');
  const tValidation = useTranslations('validation');
  const session = useSession();
  useSetPageCrumb(t('title'));

  const settings = useSettingsForm<LessonSettingsValues>({
    resolver: zodResolver(lessonSettingsSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    initial: lessonSettingsDefaults(session.workspace),
  });
  const { form, values } = settings;

  const stepper = (
    key: Key,
    unit: (count: number) => string,
    presetLabel?: (count: number) => string,
  ) => {
    const label = t(`${SECTION[key]}.label`);
    return (
      <Controller
        control={form.control}
        name={key}
        render={({ field }) => (
          <SettingStepper
            value={field.value}
            onChange={field.onChange}
            min={SETTING_NUMBERS[key].min}
            max={SETTING_NUMBERS[key].max}
            presets={SETTING_NUMBERS[key].presets}
            presetLabel={presetLabel}
            unit={unit(field.value)}
            changed={settings.isChanged(key)}
            labelledBy={`setting-${key}`}
            labels={{
              decrease: t('decrease', { label }),
              increase: t('increase', { label }),
              presets: t('presets', { label }),
            }}
          />
        )}
      />
    );
  };
  const heading = (key: Key) => (
    <SettingHeading
      id={`setting-${key}`}
      title={t(`${SECTION[key]}.label`)}
      hint={t(`${SECTION[key]}.hint`)}
      changed={settings.isChanged(key)}
    />
  );

  return (
    <form noValidate onSubmit={(event) => void settings.submit(event)}>
      <SettingsFrame
        title={t('title')}
        subtitle={t('subtitle')}
        changed={settings.changed.length}
        saving={settings.saving}
        error={settings.error}
        onCancel={settings.cancel}
        onRetry={() => void settings.submit()}
      >
        <SettingRow
          controls={
            <>
              {heading('cancellationDeadlineHours')}
              {stepper(
                'cancellationDeadlineHours',
                () => tUnits('hoursUnit'),
                (count) => tUnits('hours', { count }),
              )}
            </>
          }
          picture={<CancellationExplainer hours={values.cancellationDeadlineHours} />}
        />
        <Separator />
        <SettingRow
          controls={
            <>
              {heading('scheduleHorizonWeeks')}
              {stepper(
                'scheduleHorizonWeeks',
                (count) => tUnits('weeksUnit', { count }),
                (count) => tUnits('weeksPreset', { count }),
              )}
            </>
          }
          picture={<HorizonExplainer weeks={values.scheduleHorizonWeeks} />}
        />
        <Separator />
        <SettingRow
          controls={
            <>
              {heading('lowCreditThreshold')}
              {stepper('lowCreditThreshold', (count) => tUnits('lessonsUnit', { count }))}
            </>
          }
          picture={<LowCreditExplainer threshold={values.lowCreditThreshold} />}
        />
      </SettingsFrame>
    </form>
  );
}

const SECTION: Record<Key, 'cancellation' | 'horizon' | 'lowCredit'> = {
  cancellationDeadlineHours: 'cancellation',
  scheduleHorizonWeeks: 'horizon',
  lowCreditThreshold: 'lowCredit',
};
