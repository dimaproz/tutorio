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
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Update a student',
    description:
      'PATCH semantics: omitted fields stay unchanged, null clears an ' +
      'optional field. A no-op update creates no audit entry.',
  })
  @ApiOkResponse({ type: StudentDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'Archived students must be restored through POST /students/:studentId/restore before PATCH.',
  })
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
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive a student',
    description:
      'Owner-only and reversible. Keeps business history and suspends only ' +
      "the student's future individual schedule.",
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<void> {
    return this.students.archive(user, studentId);
  }

  @Post(':studentId/restore')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Restore an archived student (owner only)' })
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

  @Delete(':studentId/permanently')
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete an unused student (owner only)',
    description:
      'Irreversible. Returns STUDENT_HAS_BUSINESS_HISTORY when lessons, ' +
      'enrollments, packages, payments, shares, or credits exist.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  removePermanently(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ): Promise<void> {
    return this.students.remove(user, studentId);
  }
}
