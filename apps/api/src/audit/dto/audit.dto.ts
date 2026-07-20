import {
  auditLogListResponseSchema,
  listAuditLogsQuerySchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class ListAuditLogsQueryDto extends createZodDto(
  listAuditLogsQuerySchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor, so anything
// not declared in the schema is stripped from the response.
export class AuditLogListDto extends createZodDto(auditLogListResponseSchema) {}
