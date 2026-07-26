import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
  AdjustBalanceDto,
  CreatePackageDto,
  CreditLedgerDto,
  ListPackagesQueryDto,
  PackageDto,
  PackageListDto,
} from './dto/packages.dto';
import { PackagesService } from './packages.service';

@ApiTags('packages')
@ApiBearerAuth()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  @ApiOperation({ summary: 'List lesson packages' })
  @ApiOkResponse({ type: PackageListDto })
  @ZodSerializerDto(PackageListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPackagesQueryDto,
  ): Promise<PackageListDto> {
    return this.packages.list(user, query);
  }

  @Get(':packageId')
  @ApiOperation({
    summary: 'Get a package',
    description:
      'Balances, the effective total and payment status are derived from the ' +
      'credit ledger and recorded payments, never from a stored counter.',
  })
  @ApiOkResponse({ type: PackageDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackageDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ): Promise<PackageDto> {
    return this.packages.getDetail(user, packageId);
  }

  @Get(':packageId/ledger')
  @ApiOperation({
    summary: 'Credit ledger history',
    description:
      'Append-only entries explaining why the balance is what it is.',
  })
  @ApiOkResponse({ type: CreditLedgerDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(CreditLedgerDto)
  getLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ): Promise<CreditLedgerDto> {
    return this.packages.getLedger(user, packageId);
  }

  @Post()
  @ApiOperation({
    summary: 'Buy a lesson package',
    description:
      'Creates the package, its opening purchase entry, per-member shares for ' +
      'a group, and (with a schedule) the recurring series behind it.',
  })
  @ApiCreatedResponse({ type: PackageDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackageDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePackageDto,
  ): Promise<PackageDto> {
    return this.packages.create(user, dto);
  }

  @Post(':packageId/adjust')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Manually adjust a package balance',
    description: 'Appends a signed correction entry; never edits history.',
  })
  @ApiOkResponse({ type: PackageDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackageDto)
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: AdjustBalanceDto,
  ): Promise<PackageDto> {
    return this.packages.adjust(user, packageId, dto);
  }

  @Delete(':packageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a package',
    description: 'Idempotent. The credit ledger history is retained.',
  })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ): Promise<void> {
    return this.packages.remove(user, packageId);
  }
}
