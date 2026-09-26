import {
  dashboardAttentionQuerySchema,
  dashboardAttentionResponseSchema,
  dashboardMoneyResponseSchema,
  dashboardSetupResponseSchema,
} from '@tutorio/validation';
import { createZodDto } from 'nestjs-zod';

export class DashboardAttentionQueryDto extends createZodDto(
  dashboardAttentionQuerySchema,
) {}

// Response DTOs — serialized through ZodSerializerInterceptor.
export class DashboardAttentionDto extends createZodDto(
  dashboardAttentionResponseSchema,
) {}
export class DashboardMoneyDto extends createZodDto(
  dashboardMoneyResponseSchema,
) {}
export class DashboardSetupDto extends createZodDto(
  dashboardSetupResponseSchema,
) {}
