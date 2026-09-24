import {
  createPauseSchema,
  listPausesQuerySchema,
  pauseListResponseSchema,
  pauseResponseSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreatePauseDto extends createZodDto(createPauseSchema) {}
export class ListPausesQueryDto extends createZodDto(listPausesQuerySchema) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class PauseDto extends createZodDto(pauseResponseSchema) {}
export class PauseListDto extends createZodDto(pauseListResponseSchema) {}
