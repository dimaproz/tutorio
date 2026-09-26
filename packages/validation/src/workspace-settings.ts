import { z } from 'zod';
import { workspaceModeSchema, workspaceRoleSchema } from './auth';
import {
  avatarKeySchema,
  cancellationDeadlineHoursSchema,
  currencyCodeSchema,
  uuidSchema,
} from './common';
import { lowCreditThresholdSchema } from './billing';
import { scheduleHorizonWeeksSchema } from './schedules';

// Workspace-level defaults inherited by enrollments unless overridden.
export const updateWorkspaceSettingsSchema = z
  .object({
    defaultCurrency: currencyCodeSchema,
    cancellationDeadlineHours: cancellationDeadlineHoursSchema,
    // How far ahead new schedules generate lessons (L-120).
    scheduleHorizonWeeks: scheduleHorizonWeeksSchema,
    // A package direction warns with this many credits left or fewer (L-120).
    lowCreditThreshold: lowCreditThresholdSchema,
    // Switching to SOLO is refused while a second active teacher exists.
    mode: workspaceModeSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one setting must be provided',
  });

export type UpdateWorkspaceSettingsDto = z.infer<typeof updateWorkspaceSettingsSchema>;

export const workspaceSettingsResponseSchema = z.object({
  defaultCurrency: currencyCodeSchema,
  cancellationDeadlineHours: cancellationDeadlineHoursSchema,
  scheduleHorizonWeeks: scheduleHorizonWeeksSchema,
  lowCreditThreshold: lowCreditThresholdSchema,
  mode: workspaceModeSchema,
});

export type WorkspaceSettingsResponse = z.infer<typeof workspaceSettingsResponseSchema>;

// Read-only member roster: the people who can change something (the audit
// log's «Хто» filter). No mutation endpoints.
export const workspaceMemberResponseSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: z.string(),
  email: z.string(),
  role: workspaceRoleSchema,
  /** The avatar of the member's teaching profile, when they have one. */
  avatarKey: avatarKeySchema.nullable(),
});

export type WorkspaceMemberResponse = z.infer<typeof workspaceMemberResponseSchema>;

export const workspaceMemberListResponseSchema = z.object({
  items: z.array(workspaceMemberResponseSchema),
});

export type WorkspaceMemberListResponse = z.infer<typeof workspaceMemberListResponseSchema>;
