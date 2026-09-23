import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { packageFormSchema, emptyPackageForm } from '@/features/packages/model/package-form';
import { makeGroupFormSchema, emptyGroupForm } from '@/features/groups/model/form';
import { makeZodErrorMap } from './error-map';

const translate = (key: string) => `t:${key}`;

describe('makeZodErrorMap', () => {
  it('translates a custom rule by its key', () => {
    const schema = z.string().superRefine((_, ctx) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, params: { key: 'priceInvalid' } }),
    );
    const result = schema.safeParse('x', { errorMap: makeZodErrorMap(translate) });
    expect(result.success ? null : result.error.issues[0]?.message).toBe('t:priceInvalid');
  });

  // A rule that sets its own `message` bypasses the map and shows that
  // English text in every locale. The feature schemas must not do that.
  it('reaches every feature rule, so none shows a fixed English message', () => {
    const errorMap = makeZodErrorMap(translate);
    const group = makeGroupFormSchema({ teacherRequired: true }).safeParse(
      { ...emptyGroupForm('UAH'), name: 'B2', capacity: '0', weekdays: [1] },
      { errorMap },
    );
    const pkg = packageFormSchema.safeParse(
      {
        ...emptyPackageForm({ currency: 'UAH', timezone: 'Europe/Kyiv' }),
        sizingMode: 'BY_PERIOD',
        endDate: '',
      },
      { errorMap },
    );
    const messages = [
      ...(group.success ? [] : group.error.issues),
      ...(pkg.success ? [] : pkg.error.issues),
    ]
      .filter((issue) => issue.code === z.ZodIssueCode.custom)
      .map((issue) => issue.message);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) expect(message).toMatch(/^t:/);
  });
});
