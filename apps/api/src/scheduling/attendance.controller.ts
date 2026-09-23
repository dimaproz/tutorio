import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { AttendanceService } from './attendance.service';
import {
  LessonAttendanceDto,
  SetLessonAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('scheduling')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('lessons')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get(':lessonId/attendance')
  @Roles('OWNER')
  @ApiOperation({
    summary: "A lesson's participants and their attendance marks",
    description:
      'Participants are everyone already marked plus, for a group lesson, ' +
      'the live group roster.',
  })
  @ApiOkResponse({ type: LessonAttendanceDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonAttendanceDto)
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<LessonAttendanceDto> {
    return this.attendance.get(user, lessonId);
  }

  @Put(':lessonId/attendance')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Mark attendance for a lesson',
    description:
      'Sets the given participants’ marks; others keep theirs. Accepted once ' +
      'the lesson has started, unless it was cancelled (409 ' +
      'ATTENDANCE_NOT_MARKABLE). An unchanged mark writes nothing.',
  })
  @ApiOkResponse({ type: LessonAttendanceDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonAttendanceDto)
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: SetLessonAttendanceDto,
  ): Promise<LessonAttendanceDto> {
    return this.attendance.set(user, lessonId, dto);
  }
}
