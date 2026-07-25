import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PackagesModule } from '../packages/packages.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { MaterializerModule } from './materializer.module';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  // PackagesModule supplies LedgerService: a lesson status change is what
  // moves a credit balance.
  imports: [AuditModule, MaterializerModule, PackagesModule],
  controllers: [LessonsController, SeriesController],
  providers: [LessonsService, SeriesService],
})
export class SchedulingModule {}
