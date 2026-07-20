import { z } from 'zod';

type TranslateValidation = (key: string) => string;

// Maps Zod issues from the shared @tutorio/validation schemas to localized
// messages, so validation rules stay defined in exactly one place.
export function makeZodErrorMap(t: TranslateValidation): z.ZodErrorMap {
  return (issue, ctx) => {
    const field = issue.path[issue.path.length - 1];

    if (issue.code === z.ZodIssueCode.invalid_string && issue.validation === 'email') {
      return { message: t('emailInvalid') };
    }

    if (issue.code === z.ZodIssueCode.too_small) {
      switch (field) {
        case 'email':
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
      }
    }

    if (issue.code === z.ZodIssueCode.too_big) {
      switch (field) {
        case 'password':
        case 'confirmPassword':
          return { message: t('passwordTooLong') };
        case 'name':
          return { message: t('nameTooLong') };
        case 'workspaceName':
          return { message: t('workspaceNameTooLong') };
      }
    }

    if (issue.code === z.ZodIssueCode.custom) {
      const key = (issue.params as { key?: string } | undefined)?.key;
      if (key) {
        return { message: t(key) };
      }
    }

    if (issue.code === z.ZodIssueCode.invalid_type && field !== undefined) {
      return { message: t('invalid') };
    }

    return { message: ctx.defaultError };
  };
}
