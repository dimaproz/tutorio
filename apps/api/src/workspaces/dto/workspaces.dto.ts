import {
  updateWorkspaceSettingsSchema,
  workspaceMemberListResponseSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class UpdateWorkspaceSettingsDto extends createZodDto(
  updateWorkspaceSettingsSchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class WorkspaceMemberListDto extends createZodDto(
  workspaceMemberListResponseSchema,
) {}
