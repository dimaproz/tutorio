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
  CreateLessonSeriesDto,
  LessonSeriesDto,
  LessonSeriesListDto,
  ListLessonSeriesQueryDto,
  UpdateLessonSeriesDto,
} from './dto/scheduling.dto';
import { SeriesService } from './series.service';

@ApiTags('scheduling')
@ApiBearerAuth()
@Controller('lesson-series')
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  @ApiOperation({
    summary: 'List recurring lesson patterns',
    description: 'Paginated; state=deleted|all is owner-only.',
  })
  @ApiOkResponse({ type: LessonSeriesListDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonSeriesListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLessonSeriesQueryDto,
  ): Promise<LessonSeriesListDto> {
    return this.series.list(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a recurring pattern and materialize its lessons',
  })
  @ApiCreatedResponse({ type: LessonSeriesDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonSeriesDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonSeriesDto,
  ): Promise<LessonSeriesDto> {
    return this.series.create(user, dto);
  }

  @Get(':seriesId')
  @ApiOperation({ summary: 'Get a recurring pattern' })
  @ApiOkResponse({ type: LessonSeriesDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonSeriesDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
  ): Promise<LessonSeriesDto> {
    return this.series.getDetail(user, seriesId);
  }

  @Patch(':seriesId')
  @ApiOperation({
    summary: 'Update a recurring pattern',
    description:
      'Changing a schedule field regenerates future SCHEDULED lessons; a ' +
      'price-only change leaves existing lessons untouched.',
  })
  @ApiOkResponse({ type: LessonSeriesDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(LessonSeriesDto)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
    @Body() dto: UpdateLessonSeriesDto,
  ): Promise<LessonSeriesDto> {
    return this.series.update(user, seriesId, dto);
  }

  @Delete(':seriesId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a recurring pattern',
    description: 'Soft-deletes the pattern and its future scheduled lessons.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('seriesId', ParseUUIDPipe) seriesId: string,
  ): Promise<void> {
    return this.series.softDelete(user, seriesId);
  }
}
