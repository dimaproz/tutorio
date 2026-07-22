import { describe, expect, it } from 'vitest';
import { auditChangesSchema, listAuditLogsQuerySchema } from './audit';
import {
  businessErrorCodeSchema,
  moneyDecimalStringSchema,
  recordStateSchema,
  timezoneSchema,
} from './common';
import { createEnrollmentSchema, updateEnrollmentSchema } from './enrollments';
import { createGroupSchema, updateGroupSchema } from './groups';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';
import { z } from 'zod';
import { createStudentSchema, updateStudentSchema } from './students';
import { updateWorkspaceSettingsSchema } from './workspace-settings';

const UUID = '2f9f3a52-8a56-4f7e-9a34-1b4f0c9d2e11';
const UUID_2 = '7c1d61a4-5d0e-4b7a-8f43-90a4a3a1c222';

describe('common primitives', () => {
  it('accepts valid IANA timezones and rejects garbage', () => {
    expect(timezoneSchema.safeParse('Europe/Kyiv').success).toBe(true);
    expect(timezoneSchema.safeParse('UTC').success).toBe(true);
    expect(timezoneSchema.safeParse('Mars/Olympus').success).toBe(false);
    expect(timezoneSchema.safeParse('').success).toBe(false);
  });

  it('accepts non-negative decimal money strings only', () => {
    expect(moneyDecimalStringSchema.safeParse('25.50').success).toBe(true);
    expect(moneyDecimalStringSchema.safeParse('0').success).toBe(true);
    expect(moneyDecimalStringSchema.safeParse('-5').success).toBe(false);
    expect(moneyDecimalStringSchema.safeParse('1.234').success).toBe(false);
    expect(moneyDecimalStringSchema.safeParse('1,50').success).toBe(false);
  });
});

describe('pagination', () => {
  it('coerces query strings and applies defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('caps page size and rejects unknown keys', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: 10 }).success).toBe(false);
  });

  it('requires totalPages in list responses', () => {
    const schema = paginatedResponseSchema(z.string());
    expect(
      schema.safeParse({ items: ['a'], page: 1, pageSize: 20, total: 1, totalPages: 1 }).success,
    ).toBe(true);
    expect(schema.safeParse({ items: ['a'], page: 1, pageSize: 20, total: 1 }).success).toBe(
      false,
    );
  });

  it('exposes the shared record-state filter and business error codes', () => {
    expect(recordStateSchema.safeParse('deleted').success).toBe(true);
    expect(recordStateSchema.safeParse('archived').success).toBe(false);
    expect(businessErrorCodeSchema.safeParse('DUPLICATE_ENROLLMENT').success).toBe(true);
    expect(businessErrorCodeSchema.safeParse('SOMETHING_ELSE').success).toBe(false);
  });
});

describe('students', () => {
  it('accepts a minimal valid student', () => {
    const parsed = createStudentSchema.parse({ fullName: '  Alice  ', timezone: 'Europe/Kyiv' });
    expect(parsed.fullName).toBe('Alice');
  });

  it('normalizes empty optional form strings to undefined', () => {
    const parsed = createStudentSchema.parse({
      fullName: 'Alice',
      timezone: 'UTC',
      email: '',
      phone: '  ',
      telegramUsername: '',
      notes: '',
    });
    expect(parsed.email).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
    expect(parsed.telegramUsername).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it('normalizes emails like Stage 1 auth', () => {
    const parsed = createStudentSchema.parse({
      fullName: 'Alice',
      timezone: 'UTC',
      email: ' Parent@Example.COM ',
    });
    expect(parsed.email).toBe('parent@example.com');
  });

  it('accepts the new academic/pricing fields and rejects out-of-range values', () => {
    const parsed = createStudentSchema.parse({
      fullName: 'Alice',
      timezone: 'UTC',
      subject: 'ENGLISH',
      hourlyRateMinor: 5000,
      currency: 'EUR',
      status: 'ON_HOLD',
      languageLevel: 'B2',
      knowledgeLevel: 'INTERMEDIATE',
      age: 14,
      grade: 8,
      parentIds: [UUID],
    });
    expect(parsed.status).toBe('ON_HOLD');
    expect(parsed.parentIds).toEqual([UUID]);
    expect(createStudentSchema.safeParse({ fullName: 'Alice', timezone: 'UTC', grade: 13 }).success).toBe(
      false,
    );
    expect(createStudentSchema.safeParse({ fullName: 'Alice', timezone: 'UTC', age: -1 }).success).toBe(
      false,
    );
  });

  it('rejects unknown keys and missing timezone', () => {
    expect(
      createStudentSchema.safeParse({ fullName: 'Alice', timezone: 'UTC', role: 'admin' })
        .success,
    ).toBe(false);
    expect(createStudentSchema.safeParse({ fullName: 'Alice' }).success).toBe(false);
  });

  it('allows clearing optional fields with null on update only', () => {
    expect(updateStudentSchema.safeParse({ email: null, notes: null }).success).toBe(true);
    expect(updateStudentSchema.safeParse({ fullName: null }).success).toBe(false);
    expect(
      createStudentSchema.safeParse({ fullName: 'A', timezone: 'UTC', email: null }).success,
    ).toBe(false);
  });
});

describe('groups', () => {
  it('validates create and update payloads', () => {
    expect(createGroupSchema.safeParse({ name: 'B1 English' }).success).toBe(true);
    expect(createGroupSchema.safeParse({ name: '' }).success).toBe(false);
    expect(updateGroupSchema.safeParse({ notes: null }).success).toBe(true);
    expect(updateGroupSchema.safeParse({ name: null }).success).toBe(false);
  });
});

describe('enrollments', () => {
  const base = {
    studentId: UUID,
    teacherId: UUID_2,
    priceMinor: 2550,
    currency: 'EUR',
  };

  it('accepts individual and group enrollments, defaulting billingType', () => {
    const parsed = createEnrollmentSchema.parse(base);
    expect(parsed.billingType).toBe('PACKAGE');
    expect(createEnrollmentSchema.safeParse({ ...base, groupId: UUID }).success).toBe(true);
    expect(createEnrollmentSchema.safeParse({ ...base, groupId: null }).success).toBe(true);
    expect(
      createEnrollmentSchema.safeParse({ ...base, billingType: 'PER_LESSON', status: 'ACTIVE' })
        .success,
    ).toBe(false);
  });

  it('bounds priceMinor to the PostgreSQL Int range', () => {
    expect(createEnrollmentSchema.safeParse({ ...base, priceMinor: 0 }).success).toBe(true);
    expect(
      createEnrollmentSchema.safeParse({ ...base, priceMinor: 2_147_483_647 }).success,
    ).toBe(true);
    expect(createEnrollmentSchema.safeParse({ ...base, priceMinor: -1 }).success).toBe(false);
    expect(
      createEnrollmentSchema.safeParse({ ...base, priceMinor: 2_147_483_648 }).success,
    ).toBe(false);
    expect(createEnrollmentSchema.safeParse({ ...base, priceMinor: 10.5 }).success).toBe(false);
  });

  it('rejects unknown currencies and extra keys', () => {
    expect(createEnrollmentSchema.safeParse({ ...base, currency: 'XXX' }).success).toBe(false);
    expect(createEnrollmentSchema.safeParse({ ...base, price: '25.50' }).success).toBe(false);
  });

  it('bounds the cancellation deadline override to 0..336', () => {
    expect(
      createEnrollmentSchema.safeParse({ ...base, cancellationDeadlineHours: 336 }).success,
    ).toBe(true);
    expect(
      createEnrollmentSchema.safeParse({ ...base, cancellationDeadlineHours: -1 }).success,
    ).toBe(false);
    expect(
      createEnrollmentSchema.safeParse({ ...base, cancellationDeadlineHours: 337 }).success,
    ).toBe(false);
  });

  it('allows resetting the deadline override to the workspace default', () => {
    expect(updateEnrollmentSchema.safeParse({ cancellationDeadlineHours: null }).success).toBe(
      true,
    );
    expect(updateEnrollmentSchema.safeParse({ status: 'PAUSED' }).success).toBe(true);
    expect(updateEnrollmentSchema.safeParse({ studentId: UUID }).success).toBe(false);
  });
});

describe('workspace settings', () => {
  it('requires at least one field and validates values', () => {
    expect(updateWorkspaceSettingsSchema.safeParse({}).success).toBe(false);
    expect(updateWorkspaceSettingsSchema.safeParse({ defaultCurrency: 'UAH' }).success).toBe(true);
    expect(
      updateWorkspaceSettingsSchema.safeParse({ cancellationDeadlineHours: 24 }).success,
    ).toBe(true);
    expect(
      updateWorkspaceSettingsSchema.safeParse({ cancellationDeadlineHours: 400 }).success,
    ).toBe(false);
  });
});

describe('audit filters', () => {
  it('accepts filters and enforces from <= to', () => {
    const ok = listAuditLogsQuerySchema.safeParse({
      entity: 'STUDENT',
      action: 'DELETE',
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-20T00:00:00.000Z',
    });
    expect(ok.success).toBe(true);

    const swapped = listAuditLogsQuerySchema.safeParse({
      from: '2026-07-20T00:00:00.000Z',
      to: '2026-07-01T00:00:00.000Z',
    });
    expect(swapped.success).toBe(false);
  });

  it('rejects unknown entities and actions', () => {
    expect(listAuditLogsQuerySchema.safeParse({ entity: 'LESSON' }).success).toBe(false);
    expect(listAuditLogsQuerySchema.safeParse({ action: 'PURGE' }).success).toBe(false);
  });

  it('validates the field-level changes payload shape', () => {
    expect(
      auditChangesSchema.safeParse({
        fields: { name: { before: 'Old', after: 'New' } },
      }).success,
    ).toBe(true);
    expect(auditChangesSchema.safeParse({ fields: 'nope' }).success).toBe(false);
    expect(auditChangesSchema.safeParse({}).success).toBe(false);
  });
});
