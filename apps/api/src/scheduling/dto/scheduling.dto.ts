import {
  createLessonSchema,
  createMakeupSchema,
  createScheduleSchema,
  listSchedulesQuerySchema,
  scheduleChangePreviewSchema,
  scheduleChangeResultSchema,
  scheduleChangeSchema,
  scheduleListResponseSchema,
  scheduleResponseSchema,
  stopScheduleSchema,
  updateScheduleSchema,
  createLessonSeriesSchema,
  forceQuerySchema,
  lessonListResponseSchema,
  lessonResponseSchema,
  lessonSeriesListResponseSchema,
  lessonSeriesResponseSchema,
  listLessonSeriesQuerySchema,
  listLessonsQuerySchema,
  rescheduleLessonSchema,
  transitionLessonSchema,
  updateLessonSchema,
  updateLessonSeriesSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreateLessonDto extends createZodDto(createLessonSchema) {}
export class UpdateLessonDto extends createZodDto(updateLessonSchema) {}
export class CreateMakeupDto extends createZodDto(createMakeupSchema) {}
export class RescheduleLessonDto extends createZodDto(rescheduleLessonSchema) {}
export class TransitionLessonDto extends createZodDto(transitionLessonSchema) {}
export class ListLessonsQueryDto extends createZodDto(listLessonsQuerySchema) {}
export class CreateLessonSeriesDto extends createZodDto(
  createLessonSeriesSchema,
) {}
export class UpdateLessonSeriesDto extends createZodDto(
  updateLessonSeriesSchema,
) {}
export class ForceQueryDto extends createZodDto(forceQuerySchema) {}
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

// Schedules (product/scheduling.md L-20…L-27).
export class CreateScheduleDto extends createZodDto(createScheduleSchema) {}
export class ScheduleChangeDto extends createZodDto(scheduleChangeSchema) {}
export class StopScheduleDto extends createZodDto(stopScheduleSchema) {}
export class UpdateScheduleDto extends createZodDto(updateScheduleSchema) {}
export class ListSchedulesQueryDto extends createZodDto(
  listSchedulesQuerySchema,
) {}
export class ScheduleDto extends createZodDto(scheduleResponseSchema) {}
export class ScheduleListDto extends createZodDto(scheduleListResponseSchema) {}
export class ScheduleChangePreviewDto extends createZodDto(
  scheduleChangePreviewSchema,
) {}
export class ScheduleChangeResultDto extends createZodDto(
  scheduleChangeResultSchema,
) {}
