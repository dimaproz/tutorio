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
  CreateLessonDto,
  ForceQueryDto,
  LessonDto,
  LessonListDto,
  ListLessonsQueryDto,
  RescheduleLessonDto,
  TransitionLessonDto,
  UpdateLessonDto,
} from './dto/scheduling.dto';
import { LessonsService } from './lessons.service';

@ApiTags('scheduling')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  @Roles('OWNER')
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
  @Roles('OWNER')
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

  @Patch(':lessonId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Correct a booked lesson',
    description:
      'Notes and price. Sending notes:null clears the note; price and currency ' +
      'travel together. Moving a lesson uses /reschedule.',
  })
  @ApiOkResponse({ type: LessonDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonDto> {
    return this.lessons.update(user, lessonId, dto);
  }

  @Delete(':lessonId')
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a lesson',
    description:
      'Idempotent. A series lesson is also detached so it is not regenerated.',
  })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<void> {
    return this.lessons.remove(user, lessonId);
  }

  @Patch(':lessonId/reschedule')
  @Roles('OWNER')
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
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Change a lesson status',
    description:
      'Enforces the lesson state machine. Cancelling requires cancelledBy. ' +
      'Charged terminal states consume one package credit and restoration ' +
      'appends an exact compensation.',
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
