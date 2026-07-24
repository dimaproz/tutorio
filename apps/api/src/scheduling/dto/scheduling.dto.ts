import {
  createLessonSchema,
  createLessonSeriesSchema,
  lessonListResponseSchema,
  lessonResponseSchema,
  lessonSeriesListResponseSchema,
  lessonSeriesResponseSchema,
  listLessonSeriesQuerySchema,
  listLessonsQuerySchema,
  rescheduleLessonSchema,
  transitionLessonSchema,
  updateLessonSeriesSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreateLessonDto extends createZodDto(createLessonSchema) {}
export class RescheduleLessonDto extends createZodDto(rescheduleLessonSchema) {}
export class TransitionLessonDto extends createZodDto(transitionLessonSchema) {}
export class ListLessonsQueryDto extends createZodDto(listLessonsQuerySchema) {}
export class CreateLessonSeriesDto extends createZodDto(
  createLessonSeriesSchema,
) {}
export class UpdateLessonSeriesDto extends createZodDto(
  updateLessonSeriesSchema,
) {}
export class ListLessonSeriesQueryDto extends createZodDto(
  listLessonSeriesQuerySchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class LessonDto extends createZodDto(lessonResponseSchema) {}
export class LessonListDto extends createZodDto(lessonListResponseSchema) {}
export class LessonSeriesDto extends createZodDto(lessonSeriesResponseSchema) {}
export class LessonSeriesListDto extends createZodDto(
  lessonSeriesListResponseSchema,
) {}
