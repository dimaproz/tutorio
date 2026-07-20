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
  GroupDetailDto,
  GroupDto,
  GroupListDto,
  ListGroupsQueryDto,
  UpdateGroupDto,
} from './dto/groups.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @ApiOperation({
    summary: 'List workspace groups',
    description:
      'Paginated summaries with active student counts. ' +
      'state=deleted|all is owner-only.',
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

  @Post()
  @ApiOperation({ summary: 'Create a group' })
  @ApiCreatedResponse({ type: GroupDto })
  @ZodSerializerDto(GroupDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ): Promise<GroupDto> {
    return this.groups.create(user, dto);
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'Get a group with enrollment summaries' })
  @ApiOkResponse({ type: GroupDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupDetailDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<GroupDetailDto> {
    return this.groups.getDetail(user, groupId);
  }

  @Patch(':groupId')
  @ApiOperation({
    summary: 'Update a group',
    description:
      'PATCH semantics: omitted fields stay unchanged, null clears an ' +
      'optional field. A no-op update creates no audit entry.',
  })
  @ApiOkResponse({ type: GroupDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(GroupDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupDto> {
    return this.groups.update(user, groupId, dto);
  }

  @Delete(':groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a group (move to trash)',
    description:
      'Idempotent. Fails with ACTIVE_ENROLLMENTS_EXIST while the group ' +
      'has active or paused enrollments.',
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
  @Roles('OWNER')
  @ApiOperation({ summary: 'Restore a soft-deleted group (owner only)' })
  @ApiOkResponse({ type: GroupDto })
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
