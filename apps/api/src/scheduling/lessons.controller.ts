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
import { BulkCancelService } from './bulk-cancel.service';
import {
  BulkCancelDto,
  BulkCancelPreviewDto,
  BulkCancelResultDto,
  CreateLessonDto,
  CreateMakeupDto,
  ForceQueryDto,
  LessonDetailDto,
  LessonDto,
  LessonListDto,
  LessonPageDto,
  ListLessonPageQueryDto,
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
  constructor(
    private readonly lessons: LessonsService,
    private readonly bulkCancel: BulkCancelService,
  ) {}

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

  // Declared before `:lessonId` so the path is not read as a lesson id.
  @Get('list')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'The Lessons list: every lesson, paged, with quick filters',
    description:
      'Filters by period, teacher, student (their own lessons and their ' +
      "groups'), group and status; `filter` narrows to unpaid, cancelled, " +
      'no-show or needs-a-makeup lessons, and `counts` says how many each ' +
      'quick filter would show.',
  })
  @ApiOkResponse({ type: LessonPageDto })
  @ZodSerializerDto(LessonPageDto)
  listPage(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLessonPageQueryDto,
  ): Promise<LessonPageDto> {
    return this.lessons.listPage(user, query);
  }

  @Get(':lessonId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'One lesson for the side panel',
    description:
      'The lesson with its charges, the lesson its makeup replaces or the ' +
      'makeup given for it, its schedule and its history, newest first.',
  })
  @ApiOkResponse({ type: LessonDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonDetailDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<LessonDetailDto> {
    return this.lessons.getDetail(user, lessonId);
  }

  @Post('bulk-cancel/preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Preview cancelling every lesson of a period',
    description:
      'The scheduled lessons of one teacher (or of the whole studio) in ' +
      '[from, to): how many, per teacher, and the first 200. Writes nothing.',
  })
  @ApiOkResponse({ type: BulkCancelPreviewDto })
  @ZodSerializerDto(BulkCancelPreviewDto)
  previewBulkCancel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkCancelDto,
  ): Promise<BulkCancelPreviewDto> {
    return this.bulkCancel.preview(user, dto);
  }

  @Post('bulk-cancel')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Cancel every lesson of a period',
    description:
      'Holiday or illness: the scheduled lessons of one teacher (or of the ' +
      'whole studio) in [from, to) become cancelled by the teacher, free, ' +
      'with the reason. Held, cancelled and no-show lessons stay.',
  })
  @ApiCreatedResponse({ type: BulkCancelResultDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(BulkCancelResultDto)
  applyBulkCancel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkCancelDto,
  ): Promise<BulkCancelResultDto> {
    return this.bulkCancel.apply(user, dto);
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
    summary: 'Change a lesson',
    description:
      'Topic, notes, duration, teacher (a substitute for this lesson only), ' +
      'price and payment date. Sending null clears topic or notes; price and ' +
      'currency travel together. A new duration or teacher on an upcoming ' +
      'lesson is checked for teacher and student conflicts unless force=true. ' +
      'Moving a lesson in time uses /reschedule.',
  })
  @ApiOkResponse({ type: LessonDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
    @Query() query: ForceQueryDto,
  ): Promise<LessonDto> {
    return this.lessons.update(user, lessonId, dto, query.force);
  }

  @Post(':lessonId/makeup')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Assign a makeup for a cancelled or no-show lesson',
    description:
      'Creates a linked individual lesson for the same student, with the ' +
      'original teacher and duration unless others are given. Exactly one of ' +
      'the pair is charged. 409 MAKEUP_NOT_ALLOWED for a group lesson or one ' +
      'that was not cancelled or missed, MAKEUP_EXISTS for a second makeup, ' +
      'SCHEDULE_CONFLICT unless force=true.',
  })
  @ApiCreatedResponse({ type: LessonDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonDto)
  createMakeup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateMakeupDto,
    @Query() query: ForceQueryDto,
  ): Promise<LessonDto> {
    return this.lessons.createMakeup(user, lessonId, dto, query.force);
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
