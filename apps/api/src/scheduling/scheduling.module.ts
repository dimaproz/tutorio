import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { MaterializerModule } from './materializer.module';
import { SchedulesController } from './schedules.controller';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  // A lesson status or attendance change is what changes a charge.
  imports: [AuditModule, BillingModule, MaterializerModule],
  controllers: [
    LessonsController,
    AttendanceController,
    SeriesController,
    SchedulesController,
  ],
  providers: [LessonsService, AttendanceService, SeriesService],
})
export class SchedulingModule {}
