import { registerSchema, workspaceModeSchema, workspaceNameSchema } from '@tutorio/validation';
import { z } from 'zod';

/**
 * Web-only shape: `confirmPassword` never reaches the API, and the workspace
 * name is only asked for in SCHOOL mode — a solo tutor's workspace is named
 * after them, so the length rule moves onto the name field where the error can
 * actually be seen.
 */
export const registerFormSchema = registerSchema
  .omit({ workspaceName: true })
  .extend({
    workspaceName: z.string().trim().max(80),
    confirmPassword: z.string().min(1),
    // Re-declared without the API-side default so the form's input and output
    // types match: the radio group always supplies a value.
    mode: workspaceModeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        params: { key: 'confirmPasswordMismatch' },
        message: 'Passwords do not match',
      });
    }
    const nameField = data.mode === 'SOLO' ? 'name' : 'workspaceName';
    const nameValue = data.mode === 'SOLO' ? data.name : data.workspaceName;
    if (!workspaceNameSchema.safeParse(nameValue).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        type: 'string',
        minimum: 2,
        inclusive: true,
        path: [nameField],
        message: 'Too short',
      });
    }
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
