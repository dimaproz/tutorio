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
  CreateEnrollmentDto,
  EnrollmentDto,
  EnrollmentListDto,
  ListEnrollmentsQueryDto,
  UpdateEnrollmentDto,
} from './dto/enrollments.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List workspace enrollments',
    description:
      'Paginated, newest first, with compact student/group/teacher refs and ' +
      'the effective cancellation deadline. Filterable by student, group, ' +
      'teacher and status. state=deleted|all is owner-only.',
  })
  @ApiOkResponse({ type: EnrollmentListDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(EnrollmentListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListEnrollmentsQueryDto,
  ): Promise<EnrollmentListDto> {
    return this.enrollments.list(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Enroll a student with a group or an individual teacher',
    description:
      'groupId null/omitted creates an individual enrollment. Student, ' +
      'group and teacher must be live records of the current workspace. ' +
      'An indistinguishable live duplicate is rejected with ' +
      'DUPLICATE_ENROLLMENT.',
  })
  @ApiCreatedResponse({ type: EnrollmentDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(EnrollmentDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEnrollmentDto,
  ): Promise<EnrollmentDto> {
    return this.enrollments.create(user, dto);
  }

  @Get(':enrollmentId')
  @ApiOperation({ summary: 'Get an enrollment' })
  @ApiOkResponse({ type: EnrollmentDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(EnrollmentDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ): Promise<EnrollmentDto> {
    return this.enrollments.getDetail(user, enrollmentId);
  }

  @Patch(':enrollmentId')
  @ApiOperation({
    summary: 'Update enrollment billing rules or lifecycle status',
    description:
      'Student, group and teacher are immutable — archive and re-enroll ' +
      'instead. cancellationDeadlineHours null reverts to the workspace ' +
      'default. A no-op update creates no audit entry.',
  })
  @ApiOkResponse({ type: EnrollmentDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(EnrollmentDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto,
  ): Promise<EnrollmentDto> {
    return this.enrollments.update(user, enrollmentId, dto);
  }

  @Delete(':enrollmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete an enrollment (move to trash)',
    description:
      'Idempotent. For a legitimately ended relationship prefer ' +
      'status=ARCHIVED, which stays visible in history.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ): Promise<void> {
    return this.enrollments.softDelete(user, enrollmentId);
  }

  @Post(':enrollmentId/restore')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Restore a soft-deleted enrollment (owner only)',
    description:
      'Re-validates duplicate constraints; restoring next to an equivalent ' +
      'live enrollment is rejected with DUPLICATE_ENROLLMENT.',
  })
  @ApiOkResponse({ type: EnrollmentDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(EnrollmentDto)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
  ): Promise<EnrollmentDto> {
    return this.enrollments.restore(user, enrollmentId);
  }
}
