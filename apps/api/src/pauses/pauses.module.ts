import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MaterializerModule } from '../scheduling/materializer.module';
import { PausesController } from './pauses.controller';
import { PausesService } from './pauses.service';

@Module({
  imports: [AuditModule, MaterializerModule],
  controllers: [PausesController],
  providers: [PausesService],
  exports: [PausesService],
})
export class PausesModule {}
