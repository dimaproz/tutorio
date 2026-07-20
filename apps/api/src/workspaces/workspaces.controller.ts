import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrorDto, CurrentWorkspaceDto } from '../auth/dto/auth.dto';
import {
  UpdateWorkspaceSettingsDto,
  WorkspaceMemberListDto,
} from './dto/workspaces.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get the active workspace and the current member role',
  })
  @ApiOkResponse({ type: CurrentWorkspaceDto })
  @ZodSerializerDto(CurrentWorkspaceDto)
  getCurrent(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CurrentWorkspaceDto> {
    return this.workspaces.getCurrent(user);
  }

  @Patch('current/settings')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Update workspace default currency and cancellation deadline',
    description:
      'Owner only. Existing enrollments keep their configured currency and ' +
      'price; enrollments without a custom deadline inherit the new default. ' +
      'Creates a WORKSPACE UPDATE audit entry.',
  })
  @ApiOkResponse({ type: CurrentWorkspaceDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(CurrentWorkspaceDto)
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceSettingsDto,
  ): Promise<CurrentWorkspaceDto> {
    return this.workspaces.updateSettings(user, dto);
  }

  @Get('current/members')
  @ApiOperation({
    summary: 'List workspace members (teacher selector)',
    description: 'Read-only roster; member management is out of scope.',
  })
  @ApiOkResponse({ type: WorkspaceMemberListDto })
  @ZodSerializerDto(WorkspaceMemberListDto)
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceMemberListDto> {
    return this.workspaces.listMembers(user);
  }
}
