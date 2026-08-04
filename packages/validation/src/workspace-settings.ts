import { z } from 'zod';
import { workspaceModeSchema, workspaceRoleSchema } from './auth';
import { cancellationDeadlineHoursSchema, currencyCodeSchema, uuidSchema } from './common';

// Workspace-level defaults inherited by enrollments unless overridden.
export const themeColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const updateWorkspaceSettingsSchema = z
  .object({
    defaultCurrency: currencyCodeSchema,
    cancellationDeadlineHours: cancellationDeadlineHoursSchema,
    // Switching to SOLO is refused while a second active teacher exists.
    mode: workspaceModeSchema,
    primaryColor: themeColorSchema,
    secondaryColor: themeColorSchema,
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
  mode: workspaceModeSchema,
  primaryColor: themeColorSchema,
  secondaryColor: themeColorSchema,
});

export type WorkspaceSettingsResponse = z.infer<typeof workspaceSettingsResponseSchema>;

// Read-only member roster for the teacher selector (no mutation endpoints).
export const workspaceMemberResponseSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: z.string(),
  email: z.string(),
  role: workspaceRoleSchema,
});

export type WorkspaceMemberResponse = z.infer<typeof workspaceMemberResponseSchema>;

export const workspaceMemberListResponseSchema = z.object({
  items: z.array(workspaceMemberResponseSchema),
});

export type WorkspaceMemberListResponse = z.infer<typeof workspaceMemberListResponseSchema>;
