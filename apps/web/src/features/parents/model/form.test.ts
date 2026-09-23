import { describe, expect, it } from 'vitest';
import type { ParentDetail } from '@tutorio/validation';
import {
  EMPTY_PARENT_FORM,
  buildParentCreateDto,
  buildParentEditDto,
  buildParentQuickCreateDto,
  parentFormDefaults,
  parentFormSchema,
  parentFormSectionStatus,
} from './form';
import { firstName, parentContactLine, parentRoleNames, telegramHandle } from './presentation';

const STUDENT = '2f9f3a52-8a56-4f7e-9a34-1b4f0c9d2e11';

const detail: ParentDetail = {
  id: '33333333-3333-4333-8333-333333333333',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Iryna Shevchenko',
  email: 'iryna@example.test',
  phone: '+380501112233',
  telegramUsername: '@iryna_s',
  avatarKey: 'user-7',
  notes: 'Telegram only',
  createdAt: '2026-08-12T10:00:00.000Z',
  updatedAt: '2026-09-09T10:00:00.000Z',
  deletedAt: null,
  students: [
    {
      id: STUDENT,
      fullName: 'Anna Shevchenko',
      avatarKey: null,
      status: 'ACTIVE',
      languageLevel: 'B2',
    },
  ],
};

describe('parent form', () => {
  it('requires only the name', () => {
    expect(parentFormSchema.safeParse(EMPTY_PARENT_FORM).success).toBe(false);
    expect(parentFormSchema.safeParse({ ...EMPTY_PARENT_FORM, fullName: 'Iryna' }).success).toBe(
      true,
    );
  });

  it('validates the email when one is typed', () => {
    const base = { ...EMPTY_PARENT_FORM, fullName: 'Iryna' };
    expect(parentFormSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
    expect(parentFormSchema.safeParse({ ...base, email: 'iryna@example.test' }).success).toBe(true);
  });

  it('omits empty optional fields on create and normalizes Telegram', () => {
    expect(
      buildParentCreateDto({
        ...EMPTY_PARENT_FORM,
        fullName: '  Iryna Shevchenko ',
        telegramUsername: '@@iryna_s',
        studentIds: [STUDENT],
      }),
    ).toEqual({
      fullName: 'Iryna Shevchenko',
      email: undefined,
      phone: undefined,
      telegramUsername: 'iryna_s',
      avatarKey: undefined,
      studentIds: [STUDENT],
      notes: undefined,
    });
  });

  it('round-trips a saved record and clears emptied fields with null', () => {
    const values = parentFormDefaults(detail);
    expect(values).toMatchObject({
      email: 'iryna@example.test',
      telegramUsername: 'iryna_s',
      studentIds: [STUDENT],
    });
    expect(buildParentEditDto({ ...values, email: ' ', phone: '', notes: '' })).toMatchObject({
      email: null,
      phone: null,
      notes: null,
      telegramUsername: 'iryna_s',
      studentIds: [STUDENT],
    });
  });

  it('sends no student links from quick create', () => {
    expect(
      buildParentQuickCreateDto({
        fullName: 'Oleh',
        email: '',
        phone: '+380',
        telegramUsername: '',
      }),
    ).not.toHaveProperty('studentIds');
  });

  it('marks sections done, empty or in error', () => {
    const status = parentFormSectionStatus(
      { ...EMPTY_PARENT_FORM, fullName: 'Iryna', studentIds: [STUDENT] },
      ['email'],
    );
    expect(status).toEqual({
      identity: 'done',
      contacts: 'error',
      students: 'done',
      notes: 'none',
    });
  });
});

describe('parent presentation', () => {
  it('derives the role line from the linked students', () => {
    expect(parentRoleNames([])).toBe('');
    expect(parentRoleNames([{ fullName: 'Anna Shevchenko' }])).toBe('Anna Shevchenko');
    expect(
      parentRoleNames([{ fullName: 'Anna Shevchenko' }, { fullName: 'Mark Shevchenko' }]),
    ).toBe('Anna, Mark');
    expect(firstName('  Sofiia  Melnyk ')).toBe('Sofiia');
  });

  it('picks the best contact and a bare Telegram handle', () => {
    expect(parentContactLine({ phone: '+380', telegramUsername: 'x' })).toBe('+380');
    expect(parentContactLine({ telegramUsername: '@nat_m' })).toBe('@nat_m');
    expect(parentContactLine({ email: 'a@b.test' })).toBe('a@b.test');
    expect(parentContactLine({})).toBeUndefined();
    expect(telegramHandle('@@iryna')).toBe('iryna');
    expect(telegramHandle('  ')).toBeNull();
  });
});
