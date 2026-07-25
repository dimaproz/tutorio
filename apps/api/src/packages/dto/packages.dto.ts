import {
  adjustBalanceSchema,
  createPackageSchema,
  creditLedgerResponseSchema,
  listPackagesQuerySchema,
  listPaymentsQuerySchema,
  packageListResponseSchema,
  packageResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
  recordPaymentSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

// Request DTOs — validation rules live in @tutorio/validation only.
export class CreatePackageDto extends createZodDto(createPackageSchema) {}
export class AdjustBalanceDto extends createZodDto(adjustBalanceSchema) {}
export class ListPackagesQueryDto extends createZodDto(
  listPackagesQuerySchema,
) {}
export class RecordPaymentDto extends createZodDto(recordPaymentSchema) {}
export class ListPaymentsQueryDto extends createZodDto(
  listPaymentsQuerySchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class PackageDto extends createZodDto(packageResponseSchema) {}
export class PackageListDto extends createZodDto(packageListResponseSchema) {}
export class CreditLedgerDto extends createZodDto(creditLedgerResponseSchema) {}
export class PaymentDto extends createZodDto(paymentResponseSchema) {}
export class PaymentListDto extends createZodDto(paymentListResponseSchema) {}
