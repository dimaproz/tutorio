import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TeacherArchiveService } from './teacher-archive.service';
import { TeacherProfileService } from './teacher-profile.service';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  imports: [AuditModule],
  controllers: [TeachersController],
  providers: [TeachersService, TeacherProfileService, TeacherArchiveService],
})
export class TeachersModule {}
