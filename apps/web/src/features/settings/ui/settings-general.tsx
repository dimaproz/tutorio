'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2Icon, GlobeIcon, GraduationCapIcon, UserRoundIcon } from 'lucide-react';
import Link from 'next/link';
import { useNow, useTranslations } from 'next-intl';
import { Controller } from 'react-hook-form';
import { toast } from 'sonner';
import type { CurrencyCodeDto, WorkspaceMode } from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { Flag, type FlagCode } from '@/components/shared/flag';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { TextField } from '@/components/shared/text-field';
import { timezoneOffsetLabel } from '@/components/shared/timezone-combobox';
import { errorMessageKey } from '@/lib/api/error-message';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { useTeachersQuery } from '@/lib/api/teachers';
import { formatMoneyCompact } from '@/lib/money';
import {
  generalSettingsDefaults,
  generalSettingsSchema,
  SETTINGS_CURRENCIES,
  type GeneralSettingsValues,
} from '../model/form';
import { ModeRefusalDialog } from './mode-refusal-dialog';
import { ChangedMark, SettingHeading, SettingsFrame } from './settings-frame';
import { useSettingsForm } from './use-settings-form';

const FLAG: Record<CurrencyCodeDto, FlagCode> = {
  UAH: 'ua',
  PLN: 'pl',
  EUR: 'eu',
  USD: 'us',
  GBP: 'gb',
};

const TEACHER_COUNTS = { page: 1, pageSize: 1 };

/** A zone as the page names it: «Київ · UTC+3». */
function useZoneLabel(timeZone: string) {
  const t = useTranslations('settings.general');
  const now = useNow();
  const key = `cities.${timeZone.replaceAll('/', '_')}`;
  const city = t.has(key) ? t(key) : (timeZone.split('/').at(-1)?.replaceAll('_', ' ') ?? timeZone);
  const offset = timezoneOffsetLabel(timeZone, now).replace('GMT', 'UTC');
  return t('timezoneValue', { city, offset: offset === 'UTC' ? 'UTC+0' : offset });
}

/**
 * «Загальне» (`/app/settings/general`, S10 board 02): the studio's name and
 * timezone, read only in the pilot; the default currency for new records;
 * the mode, with the active teachers. Choosing tutor mode while colleagues
 * teach explains why it cannot happen (`SOLO_MODE_SINGLE_TEACHER`) instead of
 * failing on save.
 */
export function SettingsGeneralPage() {
  const t = useTranslations('settings.general');
  const tErrors = useTranslations('errors');
  const tMode = useTranslations('settings.mode');
  const tValidation = useTranslations('validation');
  const session = useSession();
  const workspace = session.workspace;
  const teachers = useTeachersQuery(TEACHER_COUNTS);
  const [refusal, setRefusal] = useState(false);
  const zone = useZoneLabel(workspace.timezone);
  useSetPageCrumb(t('title'));

  const active = teachers.data?.counts.active ?? null;
  const me = teachers.data?.me ?? null;
  const others = active === null ? null : active - (me?.status === 'ACTIVE' ? 1 : 0);

  const settings = useSettingsForm<GeneralSettingsValues>({
    resolver: zodResolver(generalSettingsSchema, {
      errorMap: makeZodErrorMap(tValidation, {
        name: { tooSmall: 'studioNameTooShort', tooBig: 'studioNameTooLong' },
      }),
      path: [],
      async: true,
    }),
    initial: generalSettingsDefaults(workspace),
    onRefused: (error) => {
      if (error.code === 'SOLO_MODE_SINGLE_TEACHER') {
        settings.form.setValue('mode', settings.saved.mode, { shouldDirty: true });
        setRefusal(true);
        return true;
      }
      if (error.code === 'SOLO_OWNER_MUST_TEACH') {
        settings.form.setValue('mode', settings.saved.mode, { shouldDirty: true });
        toast.error(tErrors(errorMessageKey(error)));
        return true;
      }
      return false;
    },
  });
  const { form, values } = settings;

  const currencyOptions = SETTINGS_CURRENCIES.map((code) => ({
    value: code,
    icon: null,
    media: <Flag code={FLAG[code]} className="mt-0.5 size-6" />,
    title: `${formatMoneyCompact(0, code, 'en').symbol} ${code}`,
    hint: t(`currencyNames.${code}`),
  }));
  const modeOptions: {
    value: WorkspaceMode;
    icon: React.ReactNode;
    title: string;
    hint: string;
  }[] = [
    { value: 'SOLO', icon: <UserRoundIcon />, title: tMode('SOLO'), hint: t('soloHint') },
    { value: 'SCHOOL', icon: <Building2Icon />, title: tMode('SCHOOL'), hint: t('schoolHint') },
  ];

  const chooseMode = (mode: WorkspaceMode, onChange: (mode: WorkspaceMode) => void) => {
    // The API refuses tutor mode while colleagues teach: say why at once.
    if (mode === 'SOLO' && settings.saved.mode !== 'SOLO' && (others ?? 0) > 0) {
      setRefusal(true);
      return;
    }
    onChange(mode);
  };

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
        <div className="grid gap-5 lg:grid-cols-2">
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('name')}
                labelAction={settings.isChanged('name') ? <ChangedMark /> : undefined}
                hint={t('nameHint')}
                error={fieldState.error?.message}
                icon={<Building2Icon />}
                maxLength={80}
                autoComplete="organization"
              />
            )}
          />
          <TextField
            label={t('timezone')}
            hint={t('timezoneHint')}
            icon={<GlobeIcon />}
            value={zone}
            readOnly
            locked
          />
        </div>

        <section aria-labelledby="settings-currency" className="flex flex-col gap-4">
          <SettingHeading
            id="settings-currency"
            title={t('currency')}
            hint={t('currencyHint')}
            changed={settings.isChanged('defaultCurrency')}
          />
          <Controller
            control={form.control}
            name="defaultCurrency"
            render={({ field }) => (
              <ChoiceCardGroup
                label={t('currency')}
                appearance="tile"
                idleIndicator={false}
                value={field.value}
                onValueChange={field.onChange}
                options={currencyOptions}
                className="grid-cols-2 gap-3 lg:grid-cols-5"
              />
            )}
          />
        </section>

        <section aria-labelledby="settings-mode" className="flex flex-col gap-4">
          <SettingHeading
            id="settings-mode"
            title={t('mode')}
            changed={settings.isChanged('mode')}
          />
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <ChoiceCardGroup
                label={t('mode')}
                appearance="tile"
                value={field.value}
                onValueChange={(mode) => chooseMode(mode, field.onChange)}
                options={modeOptions}
                className="gap-3 lg:grid-cols-2"
              />
            )}
          />
          {active !== null && values.mode === 'SCHOOL' ? (
            <div className="flex min-h-12 items-center gap-3 rounded-tile bg-background px-4 py-2.5 text-[13px] leading-[18px]">
              <GraduationCapIcon aria-hidden="true" className="size-4.5 shrink-0 text-brand" />
              <span className="grow text-muted-foreground">
                {t.rich('teachersNote', {
                  count: active,
                  b: (chunks) => <strong className="font-bold text-foreground">{chunks}</strong>,
                })}
              </span>
              <Link
                href="/app/teachers"
                className="shrink-0 rounded-control text-sm font-bold text-brand outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t('teachersLink')}
              </Link>
            </div>
          ) : null}
        </section>
      </SettingsFrame>
      <ModeRefusalDialog
        open={refusal}
        onOpenChange={setRefusal}
        studio={settings.saved.name}
        others={others ?? 0}
      />
    </form>
  );
}
