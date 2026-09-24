import { Controller, Get } from '@nestjs/common';
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
import { BillingReadsService } from './billing-reads.service';
import { CreditWarningListDto } from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('billing')
export class BillingController {
  constructor(private readonly reads: BillingReadsService) {}

  @Get('warnings')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Directions that are running out of credits',
    description:
      'Every live direction paid by packages with lessons on debt, no ' +
      'credits left, or no more than the studio threshold left (L-82).',
  })
  @ApiOkResponse({ type: CreditWarningListDto })
  @ZodSerializerDto(CreditWarningListDto)
  listWarnings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreditWarningListDto> {
    return this.reads.listCreditWarnings(user);
  }
}
