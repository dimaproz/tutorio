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
  ApiQuery,
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
  PackageDto,
  PackageListDto,
  PackagePreviewDto,
  PackageTransferDto,
  RefundPackageDto,
  SellToMembersDto,
  SoldPackagesDto,
  TransferPackageDto,
} from './dto/packages.dto';
import { ForceQueryDto } from '../scheduling/dto/scheduling.dto';
import { PackagesService } from './packages.service';

@ApiTags('packages')
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'OWNER role required' })
@Controller('packages')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({ summary: 'List lesson packages' })
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
    summary: 'Buy a lesson package',
    description:
      'Creates the package, its opening purchase entry, per-member shares for ' +
      'a group, and (with a schedule) the recurring series behind it.',
  })
  @ApiCreatedResponse({ type: PackageDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  @ZodSerializerDto(PackageDto)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePackageDto,
    @Query() query: ForceQueryDto,
  ): Promise<PackageDto> {
    return this.packages.create(user, dto, query.force);
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
    summary: 'Archive a package',
    description:
      'Idempotent. Stops owned series and future scheduled lessons; financial history is retained.',
  })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ): Promise<void> {
    return this.packages.remove(user, packageId);
  }
}
