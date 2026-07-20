import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentWorkspaceDto } from '../auth/dto/auth.dto';
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
}
