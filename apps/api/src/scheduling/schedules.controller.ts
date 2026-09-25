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
  CreateScheduleDto,
  ForceQueryDto,
  ListSchedulesQueryDto,
  ScheduleChangeDto,
  ScheduleChangePreviewDto,
  ScheduleChangeResultDto,
  ScheduleCreatePreviewDto,
  ScheduleDto,
  ScheduleHorizonPreviewDto,
  ScheduleListDto,
  StopScheduleDto,
  UpdateScheduleDto,
} from './dto/scheduling.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('scheduling')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'List schedules',
    description:
      'Every recurring schedule of the studio: who, teacher, the days and ' +
      'times in force, a planned change, the horizon, the end and the next ' +
      'lesson. state defaults to ACTIVE.',
  })
  @ApiOkResponse({ type: ScheduleListDto })
  @ZodSerializerDto(ScheduleListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSchedulesQueryDto,
  ): Promise<ScheduleListDto> {
    return this.schedules.list(user, query);
  }

  @Post()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Create a schedule',
    description:
      'For a student with one teacher, or a group (taught by its teacher). ' +
      'Each weekday has its own start time; lessons are generated horizonWeeks ' +
      'ahead and topped up daily. 409 SCHEDULE_EXISTS names the active ' +
      'schedule of that direction; SCHEDULE_CONFLICT lists teacher or student ' +
      'overlaps unless force=true.',
  })
  @ApiCreatedResponse({ type: ScheduleDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ScheduleDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
    @Query() query: ForceQueryDto,
  ): Promise<ScheduleDto> {
    return this.schedules.create(user, dto, query.force);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Preview a new schedule',
    description:
      'Exactly what creating the schedule would do: the lessons generated ' +
      'at once within the horizon, the first one, the active schedule of the ' +
      'same direction or group if there is one (create would answer ' +
      'SCHEDULE_EXISTS), and the teacher or student overlaps. Writes ' +
      'nothing, and never opens a direction for a student.',
  })
  @ApiOkResponse({ type: ScheduleCreatePreviewDto })
  @ZodSerializerDto(ScheduleCreatePreviewDto)
  previewCreate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
  ): Promise<ScheduleCreatePreviewDto> {
    return this.schedules.previewCreate(user, dto);
  }

  @Get(':scheduleId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'One schedule' })
  @ApiOkResponse({ type: ScheduleDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ScheduleDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ): Promise<ScheduleDto> {
    return this.schedules.getDetail(user, scheduleId);
  }

  @Patch(':scheduleId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Change how far ahead a schedule generates lessons',
  })
  @ApiOkResponse({ type: ScheduleDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ScheduleDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleDto> {
    return this.schedules.update(user, scheduleId, dto);
  }

  @Post(':scheduleId/horizon/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Preview a new horizon',
    description:
      'Exactly what saving the horizon would do: the lessons it generates ' +
      'now and the last lesson booked then. A shorter horizon keeps what is ' +
      'booked and adds nothing. Writes nothing.',
  })
  @ApiOkResponse({ type: ScheduleHorizonPreviewDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ScheduleHorizonPreviewDto)
  previewHorizon(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleHorizonPreviewDto> {
    return this.schedules.previewHorizon(user, scheduleId, dto);
  }

  @Post(':scheduleId/changes/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Preview a change of days, times or length',
    description:
      'Exactly what applying the change would do: lessons moved (keeping ' +
      'their topic and notes), unchanged, created, removed and kept, lessons ' +
      'whose topic or notes would be lost, and conflicts. Writes nothing.',
  })
  @ApiOkResponse({ type: ScheduleChangePreviewDto })
  @ZodSerializerDto(ScheduleChangePreviewDto)
  previewChange(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: ScheduleChangeDto,
  ): Promise<ScheduleChangePreviewDto> {
    return this.schedules.previewChange(user, scheduleId, dto);
  }

  @Post(':scheduleId/changes')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Change days, times or length from a date',
    description:
      'Lessons before effectiveFrom are untouched; the ones after it move to ' +
      'the new times where they can. SCHEDULE_CONFLICT unless force=true.',
  })
  @ApiCreatedResponse({ type: ScheduleChangeResultDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ScheduleChangeResultDto)
  change(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: ScheduleChangeDto,
    @Query() query: ForceQueryDto,
  ): Promise<ScheduleChangeResultDto> {
    return this.schedules.change(user, scheduleId, dto, query.force);
  }

  @Post(':scheduleId/stop/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Preview stopping a schedule from a date' })
  @ApiOkResponse({ type: ScheduleChangePreviewDto })
  @ZodSerializerDto(ScheduleChangePreviewDto)
  previewStop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: StopScheduleDto,
  ): Promise<ScheduleChangePreviewDto> {
    return this.schedules.previewStop(user, scheduleId, dto);
  }

  @Post(':scheduleId/stop')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Stop a schedule from a date',
    description:
      'Its scheduled lessons from that date are removed; lessons moved by ' +
      'hand, held, cancelled or marked stay. A future date keeps the schedule ' +
      'until then.',
  })
  @ApiCreatedResponse({ type: ScheduleChangeResultDto })
  @ZodSerializerDto(ScheduleChangeResultDto)
  stop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: StopScheduleDto,
  ): Promise<ScheduleChangeResultDto> {
    return this.schedules.stop(user, scheduleId, dto);
  }
}
