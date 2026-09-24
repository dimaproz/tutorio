import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { PausesModule } from '../pauses/pauses.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [AuditModule, BillingModule, PausesModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
