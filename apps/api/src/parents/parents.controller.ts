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
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'List workspace parents',
    description:
      'Paginated summaries with each parent’s linked-student roster. ' +
      'Search covers full name, email, phone and Telegram username. ' +
      'studentId narrows to one student’s parents; linked=none keeps only ' +
      'parents with no live linked student and is ignored with studentId. ' +
      'sort=fullName|createdAt with order sorts the whole collection. ' +
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
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Update a parent',
    description:
      'PATCH semantics: omitted fields stay unchanged, null clears an ' +
      'optional field. A no-op update creates no audit entry. Returns the ' +
      'parent detail with its live student roster.',
  })
  @ApiOkResponse({ type: ParentDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(ParentDetailDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Body() dto: UpdateParentDto,
  ): Promise<ParentDetailDto> {
    return this.parents.update(user, parentId, dto);
  }

  @Delete(':parentId')
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete a parent',
    description:
      'Irreversible. Removes the parent together with its student links. ' +
      'There is no trash and no restore.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ): Promise<void> {
    return this.parents.remove(user, parentId);
  }
}
