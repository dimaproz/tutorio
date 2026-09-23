import {
  lessonAttendanceResponseSchema,
  setLessonAttendanceSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class SetLessonAttendanceDto extends createZodDto(
  setLessonAttendanceSchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class LessonAttendanceDto extends createZodDto(
  lessonAttendanceResponseSchema,
) {}
