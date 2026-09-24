import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PackagesModule } from '../packages/packages.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { MaterializerModule } from './materializer.module';
import { SchedulesController } from './schedules.controller';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  // PackagesModule supplies LedgerService: a lesson status change is what
  // moves a credit balance.
  imports: [AuditModule, MaterializerModule, PackagesModule],
  controllers: [
    LessonsController,
    AttendanceController,
    SeriesController,
    SchedulesController,
  ],
  providers: [LessonsService, AttendanceService, SeriesService],
})
export class SchedulingModule {}
