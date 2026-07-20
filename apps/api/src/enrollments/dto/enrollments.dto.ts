import {
  createEnrollmentSchema,
  enrollmentListResponseSchema,
  enrollmentResponseSchema,
  listEnrollmentsQuerySchema,
  updateEnrollmentSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreateEnrollmentDto extends createZodDto(createEnrollmentSchema) {}
export class UpdateEnrollmentDto extends createZodDto(updateEnrollmentSchema) {}
export class ListEnrollmentsQueryDto extends createZodDto(
  listEnrollmentsQuerySchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class EnrollmentDto extends createZodDto(enrollmentResponseSchema) {}
export class EnrollmentListDto extends createZodDto(
  enrollmentListResponseSchema,
) {}
