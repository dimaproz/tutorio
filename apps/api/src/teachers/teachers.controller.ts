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
import { ApiErrorDto } from '../auth/dto/auth.dto';
import {
  CreateTeacherDto,
  ListTeachersQueryDto,
  TeacherDto,
  TeacherListDto,
  UpdateTeacherDto,
} from './dto/teachers.dto';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Get()
  @ApiOperation({
    summary: 'List workspace teachers',
    description: 'Paginated; search + status filter. state=deleted|all is owner-only.',
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

  @Patch(':teacherId')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a teacher',
    description: 'Hides the teacher from pickers; enrollments/lessons keep the reference.',
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
  @ApiOperation({ summary: 'Restore a soft-deleted teacher' })
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
