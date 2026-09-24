import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrorDto } from '../auth/dto/auth.dto';
import {
  CreateGroupDto,
  GroupAttendanceDto,
  GroupAttendanceQueryDto,
  GroupDetailDto,
  GroupDto,
  GroupListDto,
  GroupOptionsDto,
  GroupSummaryDto,
  ListGroupsQueryDto,
  UpdateGroupDto,
} from './dto/groups.dto';
import { GroupAttendanceService } from './group-attendance.service';
import { GroupsService } from './groups.service';
import { ForceQueryDto } from '../scheduling/dto/scheduling.dto';

@ApiTags('groups')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly attendance: GroupAttendanceService,
  ) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'List workspace groups',
    description:
      'Paginated rows with the live roster, schedule, teacher, next lesson ' +
      'and whether money is outstanding. Filters: search, state ' +
      '(deleted|all is owner-only), status, studentId, teacherId, weekday ' +
      '(0 = Sunday), payment=unpaid. Every filter is answered by the API.',
  })
  @ApiOkResponse({ type: GroupListDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListGroupsQueryDto,
  ): Promise<GroupListDto> {
    return this.groups.list(user, query);
  }

  // Static routes come before `:groupId`, which would otherwise capture them.
  @Get('summary')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Group collection headline',
    description:
      'Tab counts (live, active, empty, archived) and the four metrics: ' +
      'students in groups, free seats, group lessons this week and today ' +
      '(workspace timezone) and groups with money outstanding.',
  })
  @ApiOkResponse({ type: GroupSummaryDto })
  @ZodSerializerDto(GroupSummaryDto)
  summary(@CurrentUser() user: AuthenticatedUser): Promise<GroupSummaryDto> {
    return this.groups.summary(user);
  }

  @Get('options')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Live groups by name',
    description: 'Id and name of every live group, for filters and pickers.',
  })
  @ApiOkResponse({ type: GroupOptionsDto })
  @ZodSerializerDto(GroupOptionsDto)
  options(@CurrentUser() user: AuthenticatedUser): Promise<GroupOptionsDto> {
    return this.groups.options(user);
  }

  @Post()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Create a group',
    description:
      'Optionally with a roster and a first recurring schedule, in one ' +
      'transaction. The teacher defaults to the roster teacher, then to the ' +
      'only active teacher of the workspace. A schedule needs a teacher ' +
      '(400 GROUP_TEACHER_REQUIRED) and a free calendar (409 SCHEDULE_CONFLICT).',
  })
  @ApiCreatedResponse({ type: GroupDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
    @Query() query: ForceQueryDto,
  ): Promise<GroupDto> {
    return this.groups.create(user, dto, query.force);
  }

  @Get(':groupId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'The group page',
    description:
      'The group with its live roster, schedule, teacher, next lesson and ' +
      'lesson counts. An archived group stays readable so it can be restored.',
  })
  @ApiOkResponse({ type: GroupDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupDetailDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<GroupDetailDto> {
    return this.groups.getDetail(user, groupId);
  }

  @Get(':groupId/attendance')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Group attendance over its last held lessons',
    description:
      'The current roster over the last `window` held lessons (default 8): ' +
      'tiles and one row per participant, worst first. Cancelled lessons are ' +
      'no one’s miss; participants on hold stay out of the group figures.',
  })
  @ApiOkResponse({ type: GroupAttendanceDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupAttendanceDto)
  getAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: GroupAttendanceQueryDto,
  ): Promise<GroupAttendanceDto> {
    return this.attendance.summarize(user, groupId, query);
  }

  @Patch(':groupId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Update a group',
    description:
      'PATCH semantics: omitted fields stay unchanged, null clears an ' +
      'optional field. A no-op update creates no audit entry. `students` ' +
      'carries the complete roster and is reconciled into enrollments in the ' +
      'same transaction — added students are enrolled, dropped ones are ' +
      'removed — so a roster edit never costs one request per student. A new ' +
      '`teacherId` moves the roster, the schedule and every upcoming lesson ' +
      'to that teacher after a clash check. `schedule` only creates the ' +
      'first schedule (409 GROUP_SCHEDULE_EXISTS otherwise).',
  })
  @ApiOkResponse({ type: GroupDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
    @Query() query: ForceQueryDto,
  ): Promise<GroupDto> {
    return this.groups.update(user, groupId, dto, query.force);
  }

  @Delete(':groupId')
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive a group',
    description:
      'Owner-only and idempotent. Preserves the roster and financial history, ' +
      'then suspends related series and future scheduled lessons.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<void> {
    return this.groups.softDelete(user, groupId);
  }

  @Post(':groupId/restore')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Restore an archived group (owner only)' })
  @ApiOkResponse({ type: GroupDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'Legacy destructive group deletes require manual repair before restore.',
  })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupDto)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<GroupDto> {
    return this.groups.restore(user, groupId);
  }
}
