import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { MaterializerService } from './materializer.service';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  imports: [AuditModule],
  controllers: [LessonsController, SeriesController],
  providers: [LessonsService, SeriesService, MaterializerService],
})
export class SchedulingModule {}
