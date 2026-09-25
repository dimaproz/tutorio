import {
  createPauseSchema,
  listPausesQuerySchema,
  pauseEndPreviewResponseSchema,
  pauseEndQuerySchema,
  pauseListResponseSchema,
  pausePreviewResponseSchema,
  pausePreviewSchema,
  pauseResponseSchema,
  updatePauseSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreatePauseDto extends createZodDto(createPauseSchema) {}
export class ListPausesQueryDto extends createZodDto(listPausesQuerySchema) {}
export class PausePreviewDto extends createZodDto(pausePreviewSchema) {}
export class UpdatePauseDto extends createZodDto(updatePauseSchema) {}
export class PauseEndQueryDto extends createZodDto(pauseEndQuerySchema) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class PauseDto extends createZodDto(pauseResponseSchema) {}
export class PauseListDto extends createZodDto(pauseListResponseSchema) {}
export class PausePreviewResponseDto extends createZodDto(
  pausePreviewResponseSchema,
) {}
export class PauseEndPreviewDto extends createZodDto(
  pauseEndPreviewResponseSchema,
) {}
