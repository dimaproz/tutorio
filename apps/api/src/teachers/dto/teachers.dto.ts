import {
  createTeacherSchema,
  listTeachersQuerySchema,
  teacherListResponseSchema,
  teacherResponseSchema,
  updateTeacherSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

export class CreateTeacherDto extends createZodDto(createTeacherSchema) {}
export class UpdateTeacherDto extends createZodDto(updateTeacherSchema) {}
export class ListTeachersQueryDto extends createZodDto(listTeachersQuerySchema) {}

export class TeacherDto extends createZodDto(teacherResponseSchema) {}
export class TeacherListDto extends createZodDto(teacherListResponseSchema) {}
