import { describe, expect, it } from 'vitest';
import {
  buildStudentCreateDto,
  buildStudentEditDto,
  emptyStudentForm,
  parseStudentDraft,
  studentFormSectionStatus,
  buildStudentQuickCreateDto,
  emptyStudentQuickCreate,
  normalizeTelegram,
  resolveStudentTimezone,
  studentEditDefaults,
} from './form';

describe('student form models', () => {
  it('builds the minimum quick-create request with detected timezone', () => {
    expect(
      buildStudentQuickCreateDto({
        ...emptyStudentQuickCreate({ currency: 'EUR', timezone: 'Europe/Paris' }),
        fullName: '  Anna Shevchenko  ',
      }),
    ).toEqual({
      fullName: 'Anna Shevchenko',
      email: undefined,
      phone: undefined,
      telegramUsername: undefined,
      timezone: 'Europe/Paris',
      status: 'ACTIVE',
      hourlyRateMinor: undefined,
      currency: undefined,
      age: undefined,
      grade: undefined,
      notes: undefined,
    });
  });

  it('falls back to Europe/Kyiv when the browser does not expose a timezone', () => {
    expect(resolveStudentTimezone(undefined)).toBe('Europe/Kyiv');
    expect(resolveStudentTimezone('')).toBe('Europe/Kyiv');
    expect(resolveStudentTimezone('Europe/Paris')).toBe('Europe/Paris');
  });

  it('normalizes Telegram and maps lesson price to minor units', () => {
    const values = emptyStudentQuickCreate({ currency: 'UAH', timezone: 'Europe/Kyiv' });
    expect(
      buildStudentQuickCreateDto({
        ...values,
        fullName: 'Anna',
        telegramUsername: '@@anna_s',
        pricePerLesson: '500,50',
      }),
    ).toMatchObject({ telegramUsername: 'anna_s', hourlyRateMinor: 50050, currency: 'UAH' });
    expect(normalizeTelegram(' @anna_s ')).toBe('anna_s');
  });

  it('uses null to clear edit fields instead of create-time undefined', () => {
    const defaults = studentEditDefaults(
      {
        id: '11111111-1111-4111-8111-111111111111',
        workspaceId: '22222222-2222-4222-8222-222222222222',
        fullName: 'Anna',
        email: 'anna@example.test',
        phone: '+380501112233',
        timezone: 'Europe/Kyiv',
        telegramUsername: '@anna_s',
        hourlyRateMinor: 50050,
        currency: 'UAH',
        status: 'ACTIVE',
        languageLevel: 'B2',
        knowledgeLevel: 'INTERMEDIATE',
        age: 15,
        grade: 10,
        avatarKey: 'user-1',
        parents: [],
        enrollments: [],
        notes: 'Goals',
        createdAt: '2026-09-18T10:00:00.000Z',
        updatedAt: '2026-09-18T10:00:00.000Z',
        deletedAt: null,
      },
      'USD',
    );
    expect(defaults.telegramUsername).toBe('anna_s');
    expect(defaults.pricePerLesson).toBe('500.50');
    expect(
      buildStudentEditDto({
        ...defaults,
        email: '',
        phone: '',
        telegramUsername: '',
        pricePerLesson: '',
        languageLevel: '',
        knowledgeLevel: '',
        age: '',
        grade: '',
        notes: '',
      }),
    ).toMatchObject({
      email: null,
      phone: null,
      telegramUsername: null,
      hourlyRateMinor: null,
      currency: null,
      languageLevel: null,
      knowledgeLevel: null,
      age: null,
      grade: null,
      notes: null,
    });
  });

  it('uses the workspace currency when an unpriced student has no currency', () => {
    const defaults = studentEditDefaults(
      {
        id: '11111111-1111-4111-8111-111111111111',
        workspaceId: '22222222-2222-4222-8222-222222222222',
        fullName: 'Anna',
        email: null,
        phone: null,
        timezone: 'Europe/Kyiv',
        telegramUsername: null,
        hourlyRateMinor: null,
        currency: null,
        status: 'ACTIVE',
        languageLevel: null,
        knowledgeLevel: null,
        age: null,
        grade: null,
        avatarKey: null,
        parents: [],
        enrollments: [],
        notes: null,
        createdAt: '2026-09-18T10:00:00.000Z',
        updatedAt: '2026-09-18T10:00:00.000Z',
        deletedAt: null,
      },
      'USD',
    );

    expect(defaults.currency).toBe('USD');
    expect(buildStudentEditDto({ ...defaults, pricePerLesson: '25' })).toMatchObject({
      hourlyRateMinor: 2500,
      currency: 'USD',
    });
    expect(buildStudentEditDto(defaults)).toMatchObject({
      hourlyRateMinor: null,
      currency: null,
    });
  });
});

describe('full-page student form', () => {
  const base = emptyStudentForm({ currency: 'UAH', timezone: 'Europe/Kyiv' });

  it('marks a section done once a meaningful field is filled', () => {
    const status = studentFormSectionStatus(
      { ...base, fullName: 'Sofiia Melnyk', phone: '+380672041855', pricePerLesson: '500' },
      [],
    );
    expect(status).toEqual({
      identity: 'done',
      contacts: 'done',
      learning: 'none',
      preferences: 'done',
      pricing: 'done',
      notes: 'none',
    });
  });

  it('lets an error win over a filled section', () => {
    const status = studentFormSectionStatus({ ...base, email: 'nope' }, ['email', 'fullName']);
    expect(status.contacts).toBe('error');
    expect(status.identity).toBe('error');
  });

  it('keeps the chosen avatar and levels in the create request', () => {
    const dto = buildStudentCreateDto({
      ...base,
      fullName: ' Sofiia ',
      avatarKey: 'user-3',
      languageLevel: 'B1',
      knowledgeLevel: '',
    });
    expect(dto).toMatchObject({
      fullName: 'Sofiia',
      avatarKey: 'user-3',
      languageLevel: 'B1',
      knowledgeLevel: undefined,
      timezone: 'Europe/Kyiv',
      status: 'ACTIVE',
    });
  });

  it('restores only known string fields and a valid avatar from a draft', () => {
    expect(parseStudentDraft('{"fullName":"Anna","avatarKey":"user-2","evil":1,"age":3}')).toEqual({
      fullName: 'Anna',
      avatarKey: 'user-2',
    });
    expect(parseStudentDraft('not json')).toBeNull();
    expect(parseStudentDraft(null)).toBeNull();
  });
});
