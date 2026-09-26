import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// The owner's Today page (S11): reads only, one per block.
@Module({
  imports: [BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
