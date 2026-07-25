import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MaterializerModule } from '../scheduling/materializer.module';
import { LedgerService } from './ledger.service';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuditModule, MaterializerModule],
  controllers: [PackagesController, PaymentsController],
  providers: [PackagesService, PaymentsService, LedgerService],
  // Scheduling writes to the ledger when a lesson status changes.
  exports: [LedgerService],
})
export class PackagesModule {}
