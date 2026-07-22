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
  CreateStudentDto,
  ListStudentsQueryDto,
  StudentDetailDto,
  StudentDto,
  StudentListDto,
  UpdateStudentDto,
} from './dto/students.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List workspace students',
    description:
      'Paginated summaries with active enrollment counts and group names. ' +
      'Search covers full name, contacts and Telegram username. ' +
      'state=deleted|all is owner-only.',
  })
  @ApiOkResponse({ type: StudentListDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(StudentListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListStudentsQueryDto,
  ): Promise<StudentListDto> {
    return this.students.list(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a student' })
  @ApiCreatedResponse({ type: StudentDto })
  @ZodSerializerDto(StudentDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudentDto,
  ): Promise<StudentDto> {
    return this.students.create(user, dto);
  }

  @Get(':studentId')
  @ApiOperation({
    summary: 'Get a student profile with enrollment summaries',
  })
  @ApiOkResponse({ type: StudentDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(StudentDetailDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<StudentDetailDto> {
    return this.students.getDetail(user, studentId);
  }

  @Patch(':studentId')
  @ApiOperation({
    summary: 'Update a student',
    description:
      'PATCH semantics: omitted fields stay unchanged, null clears an ' +
      'optional field. A no-op update creates no audit entry.',
  })
  @ApiOkResponse({ type: StudentDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(StudentDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentDto> {
    return this.students.update(user, studentId, dto);
  }

  @Delete(':studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a student (move to trash)',
    description:
      'Idempotent. Fails with ACTIVE_ENROLLMENTS_EXIST while the student ' +
      'has active or paused enrollments.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<void> {
    return this.students.softDelete(user, studentId);
  }

  @Post(':studentId/restore')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Restore a soft-deleted student (owner only)' })
  @ApiOkResponse({ type: StudentDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(StudentDto)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<StudentDto> {
    return this.students.restore(user, studentId);
  }
}
