import {
  creditWarningListResponseSchema,
  groupBillingResponseSchema,
  studentBillingResponseSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Response DTOs — serialized through ZodSerializerInterceptor.
export class StudentBillingDto extends createZodDto(
  studentBillingResponseSchema,
) {}
export class CreditWarningListDto extends createZodDto(
  creditWarningListResponseSchema,
) {}
export class GroupBillingDto extends createZodDto(groupBillingResponseSchema) {}
