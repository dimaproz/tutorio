import {
  cancellationDeadlineHoursSchema,
  currencyCodeSchema,
  lowCreditThresholdSchema,
  scheduleHorizonWeeksSchema,
  workspaceModeSchema,
  type CurrentWorkspace,
  type UpdateWorkspaceSettingsDto,
} from '@tutorio/validation';
import { z } from 'zod';

/** The currencies in the order the General page offers them (S10 board 02). */
export const SETTINGS_CURRENCIES = ['UAH', 'PLN', 'EUR', 'USD', 'GBP'] as const;

/** «Загальне»: what the studio works in. Name and timezone are read-only in the pilot. */
export const generalSettingsSchema = z.object({
  defaultCurrency: currencyCodeSchema,
  mode: workspaceModeSchema,
});
export type GeneralSettingsValues = z.infer<typeof generalSettingsSchema>;

/** «Заняття й пакети»: the three numbers of L-120. */
export const lessonSettingsSchema = z.object({
  cancellationDeadlineHours: cancellationDeadlineHoursSchema,
  scheduleHorizonWeeks: scheduleHorizonWeeksSchema,
  lowCreditThreshold: lowCreditThresholdSchema,
});
export type LessonSettingsValues = z.infer<typeof lessonSettingsSchema>;

type Workspace = CurrentWorkspace['workspace'];

export function generalSettingsDefaults(workspace: Workspace): GeneralSettingsValues {
  return {
    defaultCurrency: currencyCodeSchema.catch('UAH').parse(workspace.defaultCurrency),
    mode: workspace.mode,
  };
}

export function lessonSettingsDefaults(workspace: Workspace): LessonSettingsValues {
  return {
    cancellationDeadlineHours: workspace.cancellationDeadlineHours,
    scheduleHorizonWeeks: workspace.scheduleHorizonWeeks,
    lowCreditThreshold: workspace.lowCreditThreshold,
  };
}

/** The limits and presets of each number (the API's ranges, the board's pills). */
export const SETTING_NUMBERS = {
  cancellationDeadlineHours: { min: 0, max: 336, presets: [12, 24, 48] },
  scheduleHorizonWeeks: { min: 1, max: 26, presets: [2, 4, 8] },
  lowCreditThreshold: { min: 0, max: 50, presets: [] },
} as const satisfies Record<
  keyof LessonSettingsValues,
  { min: number; max: number; presets: readonly number[] }
>;

/** A typed or stepped number kept inside its setting's range. */
export function clampSetting(key: keyof LessonSettingsValues, value: number): number {
  const { min, max } = SETTING_NUMBERS[key];
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** The fields whose value differs from the saved one, in the form's order. */
export function changedSettings<T extends Record<string, unknown>>(
  values: T,
  saved: T,
): (keyof T)[] {
  return (Object.keys(saved) as (keyof T)[]).filter((key) => values[key] !== saved[key]);
}

/** The PATCH body: only what changed, so the log records exactly that. */
export function buildSettingsDto<T extends UpdateWorkspaceSettingsDto>(
  values: T,
  saved: T,
): UpdateWorkspaceSettingsDto {
  return Object.fromEntries(
    changedSettings(values, saved).map((key) => [key, values[key]]),
  ) as UpdateWorkspaceSettingsDto;
}
