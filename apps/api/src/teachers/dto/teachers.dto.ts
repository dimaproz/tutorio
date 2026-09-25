import {
  archiveTeacherSchema,
  createTeacherSchema,
  listTeachersQuerySchema,
  teacherArchivePreviewSchema,
  teacherListResponseSchema,
  teacherResponseSchema,
  teacherStudentsQuerySchema,
  teacherStudentsResponseSchema,
  teacherSummarySchema,
  updateTeacherSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

export class CreateTeacherDto extends createZodDto(createTeacherSchema) {}
export class UpdateTeacherDto extends createZodDto(updateTeacherSchema) {}
export class ListTeachersQueryDto extends createZodDto(
  listTeachersQuerySchema,
) {}
export class ArchiveTeacherDto extends createZodDto(archiveTeacherSchema) {}
export class TeacherStudentsQueryDto extends createZodDto(
  teacherStudentsQuerySchema,
) {}

export class TeacherDto extends createZodDto(teacherResponseSchema) {}
export class TeacherListDto extends createZodDto(teacherListResponseSchema) {}
export class TeacherSummaryDto extends createZodDto(teacherSummarySchema) {}
export class TeacherStudentsDto extends createZodDto(
  teacherStudentsResponseSchema,
) {}
export class TeacherArchivePreviewDto extends createZodDto(
  teacherArchivePreviewSchema,
) {}
