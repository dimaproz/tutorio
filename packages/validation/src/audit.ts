import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const auditActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'RESTORE']);
export type AuditActionDto = z.infer<typeof auditActionSchema>;

// Entities auditable in Stage 2; later stages extend this list.
export const auditEntitySchema = z.enum([
  'STUDENT',
  'PARENT',
  'GROUP',
  'TEACHER',
  'ENROLLMENT',
  'WORKSPACE',
  'LESSON',
  'LESSON_SERIES',
  'SCHEDULE',
  'PAUSE',
  'LESSON_PACKAGE',
  'PAYMENT',
]);
export type AuditEntityDto = z.infer<typeof auditEntitySchema>;

export const listAuditLogsQuerySchema = paginationQuerySchema
  .extend({
    entity: auditEntitySchema.optional(),
    entityId: uuidSchema.optional(),
    actorId: uuidSchema.optional(),
    action: auditActionSchema.optional(),
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '"from" must not be later than "to"',
    path: ['from'],
  });

export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;

// Shallow field-level diff persisted with every mutation:
// { fields: { fieldName: { before, after } } }. Stored as JSONB; the shape is
// enforced at write time by AuditService, not by the DB.
export const auditChangesSchema = z.object({
  fields: z.record(
    z.object({
      before: z.unknown(),
      after: z.unknown(),
    }),
  ),
});

export type AuditChanges = z.infer<typeof auditChangesSchema>;

// Compact actor info for the audit table. Null means the change was made by
// Tutorio itself (L-50: a lesson held automatically): users are never deleted,
// so a null actor is never a person who left.
export const auditActorSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: z.string(),
});

export type AuditActor = z.infer<typeof auditActorSchema>;

// A weekly slot as the schedules contract writes it. Declared here: importing
// it from ./schedules closes a cycle through ./scheduling, which reads this file.
const auditSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  localTime: z.string(),
});

/**
 * What the changed record is, read when the log is listed: its name now
 * (a person, a group, the studio) and the few facts that tell one lesson,
 * payment or schedule of the same person from another. A record that no
 * longer exists keeps the name its own diff carries, or none.
 */
export const auditRecordSchema = z.object({
  /** The person, group or studio; for a lesson, schedule or payment, whose it is. */
  label: z.string().nullable(),
  /** A second name: the group or teacher of a direction, a package's name. */
  detail: z.string().nullable(),
  /** A lesson's start. */
  startsAt: isoDateTimeSchema.nullable(),
  /** A payment's amount, in `currency`. */
  amountMinor: z.number().int().nullable(),
  /** The currency the record's money fields are in. */
  currency: z.string().nullable(),
  /** A schedule's current weekly slots on the studio's clock. */
  slots: z.array(auditSlotSchema).nullable(),
});

export type AuditRecord = z.infer<typeof auditRecordSchema>;

export const auditLogResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  actorId: uuidSchema.nullable(),
  actor: auditActorSchema.nullable(),
  entity: auditEntitySchema,
  entityId: z.string(),
  action: auditActionSchema,
  changes: auditChangesSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

/** A row of the audit log page: the entry and the record it names. */
export const auditLogListItemSchema = auditLogResponseSchema.extend({
  record: auditRecordSchema,
});

export type AuditLogListItem = z.infer<typeof auditLogListItemSchema>;

export const auditLogListResponseSchema = paginatedResponseSchema(auditLogListItemSchema).extend({
  /**
   * The names of the records the page's diffs point at by id (a teacher,
   * student, group, parent or package): `{ [id]: name }`. An id that no
   * longer resolves is absent.
   */
  names: z.record(z.string()),
});

export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
