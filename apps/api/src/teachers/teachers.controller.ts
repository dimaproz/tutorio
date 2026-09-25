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
import { ForceQueryDto } from '../scheduling/dto/scheduling.dto';
import {
  ArchiveTeacherDto,
  CreateTeacherDto,
  ListTeachersQueryDto,
  TeacherArchivePreviewDto,
  TeacherDto,
  TeacherListDto,
  TeacherStudentsDto,
  TeacherStudentsQueryDto,
  TeacherSummaryDto,
  UpdateTeacherDto,
} from './dto/teachers.dto';
import { TeacherArchiveService } from './teacher-archive.service';
import { TeacherProfileService } from './teacher-profile.service';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('teachers')
export class TeachersController {
  constructor(
    private readonly teachers: TeachersService,
    private readonly profile: TeacherProfileService,
    private readonly archives: TeacherArchiveService,
  ) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'List workspace teachers',
    description:
      'Paginated; search (name, contacts, subjects), status, subject and ' +
      'sort. Each item carries its students, groups and this studio week. ' +
      'The own profile of the caller comes first; while its teaching is off it ' +
      'is left out and returned as `me`. state=deleted|all is owner-only.',
  })
  @ApiOkResponse({ type: TeacherListDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTeachersQueryDto,
  ): Promise<TeacherListDto> {
    return this.teachers.list(user, query);
  }

  @Post()
  @Roles('OWNER')
  @ApiOperation({ summary: 'Create a teacher profile' })
  @ApiCreatedResponse({ type: TeacherDto })
  @ZodSerializerDto(TeacherDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeacherDto,
  ): Promise<TeacherDto> {
    return this.teachers.create(user, dto);
  }

  @Get(':teacherId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Get a teacher profile' })
  @ApiOkResponse({ type: TeacherDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ): Promise<TeacherDto> {
    return this.teachers.getDetail(user, teacherId);
  }

  @Get(':teacherId/summary')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'The metrics of a teacher profile',
    description:
      'Hours per studio week for the last six weeks, students individually ' +
      'and in groups, groups led, and the held lessons of this month, no-shows ' +
      'and lessons the students cancelled.',
  })
  @ApiOkResponse({ type: TeacherSummaryDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherSummaryDto)
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ): Promise<TeacherSummaryDto> {
    return this.profile.summary(user, teacherId);
  }

  @Get(':teacherId/students')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'The students of a teacher',
    description:
      'By name: the level and subject, whether the student studies with the ' +
      'teacher one to one, and which groups of the teacher they attend.',
  })
  @ApiOkResponse({ type: TeacherStudentsDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherStudentsDto)
  students(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query() query: TeacherStudentsQueryDto,
  ): Promise<TeacherStudentsDto> {
    return this.profile.students(user, teacherId, query);
  }

  @Post(':teacherId/archive/preview')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'What archiving a teacher changes',
    description:
      'Active schedules, future lessons, students and groups; with ' +
      '`transferTo`, the overlaps of the new teacher with the handed-over lessons.',
  })
  @ApiOkResponse({ type: TeacherArchivePreviewDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherArchivePreviewDto)
  previewArchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: ArchiveTeacherDto,
  ): Promise<TeacherArchivePreviewDto> {
    return this.archives.preview(user, teacherId, dto);
  }

  @Post(':teacherId/archive')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive a teacher, or turn your own teaching off',
    description:
      'With `transferTo`, hands the future lessons, active schedules and ' +
      'groups to that teacher after a clash check (409 SCHEDULE_CONFLICT ' +
      'unless `force`). History keeps the archived teacher.',
  })
  @ApiOkResponse({ type: TeacherDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherDto)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: ArchiveTeacherDto,
    @Query() query: ForceQueryDto,
  ): Promise<TeacherDto> {
    return this.archives.archive(user, teacherId, dto, query.force);
  }

  @Patch(':teacherId')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update a teacher' })
  @ApiOkResponse({ type: TeacherDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: UpdateTeacherDto,
  ): Promise<TeacherDto> {
    return this.teachers.update(user, teacherId, dto);
  }

  @Delete(':teacherId')
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a teacher',
    description:
      'Hides the teacher from pickers; enrollments/lessons keep the reference.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ): Promise<void> {
    return this.teachers.softDelete(user, teacherId);
  }

  @Post(':teacherId/restore')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Restore a teacher',
    description:
      'Undeletes a soft-deleted profile, or makes an archived one active ' +
      'again (solo mode allows one active teacher).',
  })
  @ApiOkResponse({ type: TeacherDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(TeacherDto)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ): Promise<TeacherDto> {
    return this.teachers.restore(user, teacherId);
  }
}
