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
import { AuditService } from './audit.service';
import { AuditLogListDto, ListAuditLogsQueryDto } from './dto/audit.dto';

// Read-only by design: the audit trail is immutable, so no update or delete
// endpoints exist for it.
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'List workspace audit log entries (owner only)',
    description:
      'Newest-first, paginated. Supports filtering by entity, entityId, ' +
      'actor, action and a createdAt time range.',
  })
  @ApiOkResponse({ type: AuditLogListDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ZodSerializerDto(AuditLogListDto)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<AuditLogListDto> {
    return this.audit.list(user, query);
  }
}
