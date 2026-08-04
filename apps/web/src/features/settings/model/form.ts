import { currencyCodeSchema, themeColorSchema, workspaceModeSchema } from '@tutorio/validation';
import { z } from 'zod';

export const workspaceSettingsFormSchema = z.object({
  defaultCurrency: currencyCodeSchema,
  cancellationDeadlineHours: z.coerce.number().int().min(0).max(336),
  mode: workspaceModeSchema,
});
export type WorkspaceSettingsFormValues = z.infer<typeof workspaceSettingsFormSchema>;

export const workspaceThemeFormSchema = z.object({
  primaryColor: themeColorSchema,
  secondaryColor: themeColorSchema,
});
export type WorkspaceThemeFormValues = z.infer<typeof workspaceThemeFormSchema>;
