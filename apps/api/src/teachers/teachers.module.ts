import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
  imports: [AuditModule],
  controllers: [TeachersController],
  providers: [TeachersService],
})
export class TeachersModule {}
