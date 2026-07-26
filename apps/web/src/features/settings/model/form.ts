import { currencyCodeSchema, workspaceModeSchema } from '@tutorio/validation';
import { z } from 'zod';

export const workspaceSettingsFormSchema = z.object({
  defaultCurrency: currencyCodeSchema,
  cancellationDeadlineHours: z.coerce.number().int().min(0).max(336),
  mode: workspaceModeSchema,
});
export type WorkspaceSettingsFormValues = z.infer<typeof workspaceSettingsFormSchema>;
