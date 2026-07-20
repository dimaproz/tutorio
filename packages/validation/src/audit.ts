import { z } from 'zod';
import { isoDateTimeSchema, uuidSchema } from './common';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const auditActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'RESTORE']);
export type AuditActionDto = z.infer<typeof auditActionSchema>;

// Entities auditable in Stage 2; later stages extend this list.
export const auditEntitySchema = z.enum(['STUDENT', 'GROUP', 'ENROLLMENT', 'WORKSPACE']);
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

// Compact actor info for the audit table; null when the actor was deleted or
// the change was system-initiated.
export const auditActorSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: z.string(),
});

export type AuditActor = z.infer<typeof auditActorSchema>;

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

export const auditLogListResponseSchema = paginatedResponseSchema(auditLogResponseSchema);

export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
