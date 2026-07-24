import {
  Body,
  Controller,
  Get,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ForceQueryDto } from '@tutorio/validation';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorDto } from '../auth/dto/auth.dto';
import {
  CreateLessonDto,
  LessonDto,
  LessonListDto,
  ListLessonsQueryDto,
  RescheduleLessonDto,
  TransitionLessonDto,
} from './dto/scheduling.dto';
import { LessonsService } from './lessons.service';

@ApiTags('scheduling')
@ApiBearerAuth()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  @ApiOperation({
    summary: 'List lessons in a time window (calendar feed)',
    description:
      'Returns every non-deleted lesson with startsAtUtc in [from, to).',
  })
  @ApiOkResponse({ type: LessonListDto })
  @ZodSerializerDto(LessonListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLessonsQueryDto,
  ): Promise<LessonListDto> {
    return this.lessons.list(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create one or many one-off lessons',
    description:
      'startsAt accepts several dates for bulk creation. Overlapping the ' +
      'teacher returns 409 SCHEDULE_CONFLICT unless force=true.',
  })
  @ApiCreatedResponse({ type: LessonListDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonListDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonDto,
    @Query() query: ForceQueryDto,
  ): Promise<LessonListDto> {
    return this.lessons.create(user, dto, query.force);
  }

  @Patch(':lessonId/reschedule')
  @ApiOperation({
    summary: 'Reschedule a lesson',
    description:
      'scope=this detaches and moves a single lesson; ' +
      'scope=this_and_following shifts the series time onward. ' +
      'Conflicts return 409 unless force=true.',
  })
  @ApiOkResponse({ type: LessonDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonDto)
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: RescheduleLessonDto,
    @Query() query: ForceQueryDto,
  ): Promise<LessonDto> {
    return this.lessons.reschedule(user, lessonId, dto, query.force);
  }

  @Patch(':lessonId/status')
  @ApiOperation({
    summary: 'Change a lesson status',
    description:
      'Enforces the lesson state machine. Cancelling requires cancelledBy. ' +
      'No ledger effect in Stage 3.',
  })
  @ApiOkResponse({ type: LessonDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonDto)
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: TransitionLessonDto,
  ): Promise<LessonDto> {
    return this.lessons.transition(user, lessonId, dto);
  }
}
