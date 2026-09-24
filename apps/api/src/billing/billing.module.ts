import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingService } from './billing.service';

// Lessons, attendance, packages and payments all change what a direction
// owes; they share this one service.
@Module({
  imports: [AuditModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
