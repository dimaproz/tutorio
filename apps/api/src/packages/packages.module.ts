import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { MaterializerModule } from '../scheduling/materializer.module';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuditModule, BillingModule, MaterializerModule],
  controllers: [PackagesController, PaymentsController],
  providers: [PackagesService, PaymentsService],
})
export class PackagesModule {}
