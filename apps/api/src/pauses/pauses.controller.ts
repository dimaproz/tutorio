import {
  Body,
  Controller,
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
  CreatePauseDto,
  ListPausesQueryDto,
  PauseDto,
  PauseEndPreviewDto,
  PauseEndQueryDto,
  PauseListDto,
  PausePreviewDto,
  PausePreviewResponseDto,
  UpdatePauseDto,
} from './dto/pauses.dto';
import { endModeOf, PausesService } from './pauses.service';

@ApiTags('pauses')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('pauses')
export class PausesController {
  constructor(private readonly pauses: PausesService) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'List pauses',
    description: 'Current (scheduled or running) pauses by default.',
  })
  @ApiOkResponse({ type: PauseListDto })
  @ZodSerializerDto(PauseListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPausesQueryDto,
  ): Promise<PauseListDto> {
    return this.pauses.list(user, query);
  }

  @Post()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Pause a student or one direction',
    description:
      'Takes the individual lessons in the window out, keeps the student out ' +
      'of group lessons and charges, and pushes the packages valid at its ' +
      'start by its length (an open pause does that when it ends).',
  })
  @ApiCreatedResponse({ type: PauseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'PAUSE_OVERLAP' })
  @ZodSerializerDto(PauseDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePauseDto,
  ): Promise<PauseDto> {
    return this.pauses.create(user, dto);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Preview a pause before it is saved',
    description:
      'Per paused direction, the individual lessons it takes out and the ' +
      'group lessons the student misses, and how it pushes the packages. ' +
      'With replacesPauseId, the pause being changed is released first, as ' +
      'the change does. Nothing is saved.',
  })
  @ApiOkResponse({ type: PausePreviewResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'PAUSE_OVERLAP, PAUSE_ENDED or PAUSE_RUNNING',
  })
  @ZodSerializerDto(PausePreviewResponseDto)
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PausePreviewDto,
  ): Promise<PausePreviewResponseDto> {
    return this.pauses.preview(user, dto);
  }

  @Get(':pauseId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Get a pause' })
  @ApiOkResponse({ type: PauseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PauseDto)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pauseId', ParseUUIDPipe) pauseId: string,
  ): Promise<PauseDto> {
    return this.pauses.getDetail(user, pauseId);
  }

  @Patch(':pauseId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Change a pause',
    description:
      'A scheduled pause takes a new window, direction and reason; a running ' +
      'one a new end and reason. The pause ends and its replacement starts in ' +
      'one step, and the replacement is returned. The lessons that come back ' +
      'outside the new window are checked for conflicts unless force; ' +
      'skipConflicts leaves the overlapping ones off.',
  })
  @ApiOkResponse({ type: PauseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'PAUSE_ENDED, PAUSE_RUNNING, PAUSE_OVERLAP or SCHEDULE_CONFLICT (details.conflicts)',
  })
  @ZodSerializerDto(PauseDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pauseId', ParseUUIDPipe) pauseId: string,
    @Body() dto: UpdatePauseDto,
    @Query() query: PauseEndQueryDto,
  ): Promise<PauseDto> {
    return this.pauses.update(user, pauseId, dto, endModeOf(query));
  }

  @Post(':pauseId/end/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Preview ending a pause now, or cancelling one that has not begun',
    description:
      'The lessons that would come back, the ones whose time is taken since, ' +
      'and how the package extensions change. Nothing is saved.',
  })
  @ApiOkResponse({ type: PauseEndPreviewDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'PAUSE_ENDED' })
  @ZodSerializerDto(PauseEndPreviewDto)
  endPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pauseId', ParseUUIDPipe) pauseId: string,
  ): Promise<PauseEndPreviewDto> {
    return this.pauses.endPreview(user, pauseId);
  }

  @Post(':pauseId/end')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'End a pause now, or cancel one that has not begun',
    description:
      'Brings its lessons from now on back and keeps only the package ' +
      'extension it used. Returning lessons are checked for teacher and ' +
      'student conflicts unless force; skipConflicts brings back only the ' +
      'free ones.',
  })
  @ApiOkResponse({ type: PauseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'PAUSE_ENDED or SCHEDULE_CONFLICT (details.conflicts)',
  })
  @ZodSerializerDto(PauseDto)
  end(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pauseId', ParseUUIDPipe) pauseId: string,
    @Query() query: PauseEndQueryDto,
  ): Promise<PauseDto> {
    return this.pauses.end(user, pauseId, endModeOf(query));
  }
}
