import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
  ListPaymentsQueryDto,
  PaymentDto,
  PaymentListDto,
  RecordPaymentDto,
} from './dto/packages.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List recorded payments' })
  @ApiOkResponse({ type: PaymentListDto })
  @ZodSerializerDto(PaymentListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaymentListDto> {
    return this.payments.list(user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Record a payment received',
    description:
      'Money only. Lesson credits live in the package ledger and are not ' +
      'touched here. Applies the amount to the member share when a package ' +
      'is given.',
  })
  @ApiCreatedResponse({ type: PaymentDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PaymentDto)
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordPaymentDto,
  ): Promise<PaymentDto> {
    return this.payments.record(user, dto);
  }
}
