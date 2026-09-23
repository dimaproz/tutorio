import {
  createGroupSchema,
  groupAttendanceQuerySchema,
  groupAttendanceResponseSchema,
  groupDetailSchema,
  groupListResponseSchema,
  groupOptionsResponseSchema,
  groupResponseSchema,
  groupSummaryResponseSchema,
  listGroupsQuerySchema,
  updateGroupSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreateGroupDto extends createZodDto(createGroupSchema) {}
export class UpdateGroupDto extends createZodDto(updateGroupSchema) {}
export class ListGroupsQueryDto extends createZodDto(listGroupsQuerySchema) {}
export class GroupAttendanceQueryDto extends createZodDto(
  groupAttendanceQuerySchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class GroupDto extends createZodDto(groupResponseSchema) {}
export class GroupDetailDto extends createZodDto(groupDetailSchema) {}
export class GroupListDto extends createZodDto(groupListResponseSchema) {}
export class GroupSummaryDto extends createZodDto(groupSummaryResponseSchema) {}
export class GroupOptionsDto extends createZodDto(groupOptionsResponseSchema) {}
export class GroupAttendanceDto extends createZodDto(
  groupAttendanceResponseSchema,
) {}
