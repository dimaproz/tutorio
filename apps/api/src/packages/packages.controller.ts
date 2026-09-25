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
  AdjustBalanceDto,
  CreatePackageDto,
  CreditLedgerDto,
  ExtendPackageDto,
  ListPackagesQueryDto,
  PackageDetailDto,
  PackageDto,
  PackageListDto,
  PackagePreviewDto,
  PackageTransferDto,
  RefundPackageDto,
  SellToMembersDto,
  SoldPackagesDto,
  TransferPackageDto,
} from './dto/packages.dto';
import { PackagesService } from './packages.service';

@ApiTags('packages')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('packages')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'List lesson packages',
    description:
      'Filters by student, group, teacher, kind, payment status, a tab ' +
      '(active, running out, unpaid, finished) and a name search; counts ' +
      'each tab and sums what the unpaid ones owe per currency.',
  })
  @ApiOkResponse({ type: PackageListDto })
  @ZodSerializerDto(PackageListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPackagesQueryDto,
  ): Promise<PackageListDto> {
    return this.packages.list(user, query);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Preview a package sale',
    description:
      'The credits (from the direction schedule for a by-period package), ' +
      'price and window a sale would have. Writes nothing.',
  })
  @ApiOkResponse({ type: PackagePreviewDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackagePreviewDto)
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePackageDto,
  ): Promise<PackagePreviewDto> {
    return this.packages.preview(user, dto);
  }

  @Post('members')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Sell one package to each selected group member',
    description:
      'One package per member, for their membership of the group; each ' +
      'member pays separately.',
  })
  @ApiCreatedResponse({ type: SoldPackagesDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(SoldPackagesDto)
  sellToMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SellToMembersDto,
  ): Promise<SoldPackagesDto> {
    return this.packages.sellToMembers(user, dto);
  }

  @Post(':packageId/extend')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Move the end of a package later' })
  @ApiCreatedResponse({ type: PackageDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackageDto)
  extend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: ExtendPackageDto,
  ): Promise<PackageDto> {
    return this.packages.extend(user, packageId, dto);
  }

  @Post(':packageId/transfer')
  @Roles('OWNER')
  @ApiOperation({
    summary: "Move unused credits to another of the student's directions",
    description:
      'Recalculated by price and rounded down; the remainder is reported.',
  })
  @ApiCreatedResponse({ type: PackageTransferDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackageTransferDto)
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: TransferPackageDto,
  ): Promise<PackageTransferDto> {
    return this.packages.transfer(user, packageId, dto);
  }

  @Post(':packageId/refund')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Take unused credits back and record the money returned',
  })
  @ApiCreatedResponse({ type: PackageDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackageDto)
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: RefundPackageDto,
  ): Promise<PackageDto> {
    return this.packages.refund(user, packageId, dto);
  }

  @Get(':packageId')
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Get a package',
    description:
      'Balances, the effective total and payment status are derived from the ' +
      'credit ledger and recorded payments, never from a stored counter. ' +
      'Also names the older package that pays first and the pauses that ' +
      'moved its end.',
  })
  @ApiOkResponse({ type: PackageDetailDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ZodSerializerDto(PackageDetailDto)
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ): Promise<PackageDetailDto> {
    return this.packages.getDetail(user, packageId);
  }

  @Get(':packageId/ledger')
  @Roles('OWNER')
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
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Sell a lesson package',
    description:
      'Creates the package and its opening purchase entry for one direction; ' +
      'lessons on debt are covered first. Never creates a schedule or records ' +
      'a payment (L-87).',
  })
  @ApiCreatedResponse({ type: PackageDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
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
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an unused package',
    description:
      'Only a package with no charged lessons and no payments (409 ' +
      'PACKAGE_IN_USE otherwise; refund it instead). Idempotent; the row is ' +
      'archived with its audit trail.',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ type: ApiErrorDto })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ): Promise<void> {
    return this.packages.remove(user, packageId);
  }
}
