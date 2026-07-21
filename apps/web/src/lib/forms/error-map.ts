import { z } from 'zod';

type TranslateValidation = (key: string) => string;

/**
 * Per-form message overrides keyed by field name. Needed when the same field
 * name means different things in different forms — `name` is a person in the
 * registration form and a group in the group form.
 */
export type ErrorMapOverrides = Record<
  string,
  { tooSmall?: string; tooBig?: string; invalid?: string }
>;

// Maps Zod issues from the shared @tutorio/validation schemas to localized
// messages, so validation rules stay defined in exactly one place.
export function makeZodErrorMap(
  t: TranslateValidation,
  overrides: ErrorMapOverrides = {},
): z.ZodErrorMap {
  return (issue, ctx) => {
    const field = String(issue.path[issue.path.length - 1] ?? '');
    const override = overrides[field];

    if (issue.code === z.ZodIssueCode.invalid_string && issue.validation === 'email') {
      return { message: t('emailInvalid') };
    }

    if (issue.code === z.ZodIssueCode.invalid_string && issue.validation === 'regex') {
      if (field === 'phone' || field === 'parentPhone') {
        return { message: t('phoneInvalid') };
      }
    }

    if (issue.code === z.ZodIssueCode.too_small) {
      if (override?.tooSmall) {
        return { message: t(override.tooSmall) };
      }
      switch (field) {
        case 'email':
        case 'parentEmail':
          return { message: t('emailInvalid') };
        case 'password':
          // login uses min(1) ("enter your password"), register uses min(12).
          return {
            message: Number(issue.minimum) > 1 ? t('passwordTooShort') : t('passwordRequired'),
          };
        case 'confirmPassword':
          return { message: t('passwordRequired') };
        case 'name':
          return { message: t('nameRequired') };
        case 'workspaceName':
          return { message: t('workspaceNameTooShort') };
        case 'fullName':
          return { message: t('fullNameRequired') };
        case 'timezone':
          return { message: t('timezoneRequired') };
        case 'phone':
        case 'parentPhone':
          return { message: t('phoneInvalid') };
        case 'priceMinor':
          return { message: t('priceRequired') };
        case 'cancellationDeadlineHours':
          return { message: t('deadlineRange') };
      }
    }

    if (issue.code === z.ZodIssueCode.too_big) {
      if (override?.tooBig) {
        return { message: t(override.tooBig) };
      }
      switch (field) {
        case 'password':
        case 'confirmPassword':
          return { message: t('passwordTooLong') };
        case 'name':
          return { message: t('nameTooLong') };
        case 'workspaceName':
          return { message: t('workspaceNameTooLong') };
        case 'fullName':
        case 'parentName':
          return { message: t('fullNameTooLong') };
        case 'phone':
        case 'parentPhone':
          return { message: t('phoneInvalid') };
        case 'notes':
          return { message: t('notesTooLong') };
        case 'cancellationDeadlineHours':
          return { message: t('deadlineRange') };
      }
    }

    if (issue.code === z.ZodIssueCode.custom) {
      const key = (issue.params as { key?: string } | undefined)?.key;
      if (key) {
        return { message: t(key) };
      }
    }

    if (issue.code === z.ZodIssueCode.invalid_type && field !== '') {
      return { message: t(override?.invalid ?? 'invalid') };
    }

    return { message: ctx.defaultError };
  };
}
