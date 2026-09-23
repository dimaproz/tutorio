import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MaterializerModule } from '../scheduling/materializer.module';
import { GroupAttendanceService } from './group-attendance.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  // The materializer generates a group's lessons the moment its roster or
  // schedule allows it, instead of waiting for the nightly run.
  imports: [AuditModule, MaterializerModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupAttendanceService],
})
export class GroupsModule {}
