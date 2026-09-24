import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingController } from './billing.controller';
import { BillingReadsService } from './billing-reads.service';
import { BillingService } from './billing.service';

// Lessons, attendance, packages and payments all change what a direction
// owes; they share this one service. The read side answers what is owed.
@Module({
  imports: [AuditModule],
  controllers: [BillingController],
  providers: [BillingService, BillingReadsService],
  exports: [BillingService, BillingReadsService],
})
export class BillingModule {}
