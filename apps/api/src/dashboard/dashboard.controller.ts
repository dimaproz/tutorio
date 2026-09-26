import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiErrorDto } from '../auth/dto/auth.dto';
import { DashboardService } from './dashboard.service';
import {
  DashboardAttentionDto,
  DashboardAttentionQueryDto,
  DashboardMoneyDto,
  DashboardSetupDto,
} from './dto/dashboard.dto';

// Each block of the Today page has its own read, so a slow or failing block
// never holds the rest of the page. The day itself is GET /lessons.
@ApiTags('dashboard')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('money')
  @Roles('OWNER')
  @ApiOperation({
    summary: "The studio's money this month",
    description:
      'Per currency, never summed: received this month and today on the ' +
      "studio's clock, the debt now with the number of debtors, and the " +
      'approximate amount expected within 7 days. Always the whole studio.',
  })
  @ApiOkResponse({ type: DashboardMoneyDto })
  @ZodSerializerDto(DashboardMoneyDto)
  money(@CurrentUser() user: AuthenticatedUser): Promise<DashboardMoneyDto> {
    return this.dashboard.money(user);
  }

  @Get('attention')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'The exceptions to act on',
    description:
      'Seven categories in a fixed order (unconfirmed attendance, makeups, ' +
      'debtors, unpaid packages, packages running out, packages expiring ' +
      'within 3 days, pauses), each with its count, its three most urgent ' +
      "rows and a two-name summary. `teacherId` keeps one teacher's.",
  })
  @ApiOkResponse({ type: DashboardAttentionDto })
  @ZodSerializerDto(DashboardAttentionDto)
  attention(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardAttentionQueryDto,
  ): Promise<DashboardAttentionDto> {
    return this.dashboard.attention(user, query);
  }

  @Get('setup')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'The first-run checklist',
    description:
      'Which set-up steps the data already ticks: a colleague (studio mode ' +
      'only), a student, a schedule or lesson, a package or payment.',
  })
  @ApiOkResponse({ type: DashboardSetupDto })
  @ZodSerializerDto(DashboardSetupDto)
  setup(@CurrentUser() user: AuthenticatedUser): Promise<DashboardSetupDto> {
    return this.dashboard.setup(user);
  }
}
