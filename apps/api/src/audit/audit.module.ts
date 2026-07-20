import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// AuditService is exported so feature modules (students, groups, enrollments,
// workspaces) can write audit rows inside their own Prisma transactions.
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
