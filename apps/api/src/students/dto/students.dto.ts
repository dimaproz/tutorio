import {
  createStudentSchema,
  listStudentsQuerySchema,
  studentDetailSchema,
  studentListResponseSchema,
  studentResponseSchema,
  updateStudentSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreateStudentDto extends createZodDto(createStudentSchema) {}
export class UpdateStudentDto extends createZodDto(updateStudentSchema) {}
export class ListStudentsQueryDto extends createZodDto(
  listStudentsQuerySchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class StudentDto extends createZodDto(studentResponseSchema) {}
export class StudentDetailDto extends createZodDto(studentDetailSchema) {}
export class StudentListDto extends createZodDto(studentListResponseSchema) {}
