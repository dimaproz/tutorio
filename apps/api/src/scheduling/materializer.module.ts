import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MaterializerService } from './materializer.service';
import { SchedulesService } from './schedules.service';

/**
 * The materializer and the schedules it serves stand alone so scheduling,
 * groups and packages can all create or change a schedule without importing
 * each other.
 */
@Module({
  imports: [AuditModule],
  providers: [MaterializerService, SchedulesService],
  exports: [MaterializerService, SchedulesService],
})
export class MaterializerModule {}
