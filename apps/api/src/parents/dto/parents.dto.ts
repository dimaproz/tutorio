import {
  createParentSchema,
  listParentsQuerySchema,
  parentDetailSchema,
  parentListResponseSchema,
  parentResponseSchema,
  updateParentSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreateParentDto extends createZodDto(createParentSchema) {}
export class UpdateParentDto extends createZodDto(updateParentSchema) {}
export class ListParentsQueryDto extends createZodDto(listParentsQuerySchema) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class ParentDto extends createZodDto(parentResponseSchema) {}
export class ParentDetailDto extends createZodDto(parentDetailSchema) {}
export class ParentListDto extends createZodDto(parentListResponseSchema) {}
