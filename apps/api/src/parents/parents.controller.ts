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
import {
  CreateParentDto,
  ListParentsQueryDto,
  ParentDetailDto,
  ParentDto,
  ParentListDto,
  UpdateParentDto,
} from './dto/parents.dto';
import { ParentsService } from './parents.service';

@ApiTags('parents')
@ApiBearerAuth()
@Controller('parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List workspace parents',
    description:
      'Paginated summaries with each parent’s linked-student roster. ' +
      'Search covers full name, phone and Telegram username. ' +
      'state=deleted|all is owner-only.',
  })
  @ApiOkResponse({ type: ParentListDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ParentListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListParentsQueryDto,
  ): Promise<ParentListDto> {
    return this.parents.list(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a parent' })
  @ApiCreatedResponse({ type: ParentDto })
  @ZodSerializerDto(ParentDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateParentDto,
  ): Promise<ParentDto> {
    return this.parents.create(user, dto);
  }

  @Get(':parentId')
  @ApiOperation({ summary: 'Get a parent with their linked-student roster' })
  @ApiOkResponse({ type: ParentDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ParentDetailDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ): Promise<ParentDetailDto> {
    return this.parents.getDetail(user, parentId);
  }

  @Patch(':parentId')
  @ApiOperation({
    summary: 'Update a parent',
    description:
      'PATCH semantics: omitted fields stay unchanged, null clears an ' +
      'optional field. A no-op update creates no audit entry.',
  })
  @ApiOkResponse({ type: ParentDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ParentDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Body() dto: UpdateParentDto,
  ): Promise<ParentDto> {
    return this.parents.update(user, parentId, dto);
  }

  @Delete(':parentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a parent (move to trash)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ): Promise<void> {
    return this.parents.softDelete(user, parentId);
  }

  @Post(':parentId/restore')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Restore a soft-deleted parent (owner only)' })
  @ApiOkResponse({ type: ParentDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ParentDto)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ): Promise<ParentDto> {
    return this.parents.restore(user, parentId);
  }
}
