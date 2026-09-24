import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrorDto } from '../auth/dto/auth.dto';
import { ForceQueryDto } from '../scheduling/dto/scheduling.dto';
import {
  CreatePauseDto,
  ListPausesQueryDto,
  PauseDto,
  PauseListDto,
} from './dto/pauses.dto';
import { PausesService } from './pauses.service';

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

  @Post(':pauseId/end')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'End a pause now, or cancel one that has not begun',
    description:
      'Brings its lessons from now on back (checked for teacher conflicts ' +
      'unless force) and keeps only the package extension it used.',
  })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  @ApiOkResponse({ type: PauseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'PAUSE_ENDED or SCHEDULE_CONFLICT',
  })
  @ZodSerializerDto(PauseDto)
  end(
    @CurrentUser() user: AuthenticatedUser,
    @Param('pauseId', ParseUUIDPipe) pauseId: string,
    @Query() query: ForceQueryDto,
  ): Promise<PauseDto> {
    return this.pauses.end(user, pauseId, query.force);
  }
}
