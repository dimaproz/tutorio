import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AccessTokenGuard } from './auth/guards/access-token.guard';
import { ClientThrottlerGuard } from './auth/guards/client-throttler.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { type Env, validateEnv } from './config/env';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { PackagesModule } from './packages/packages.module';
import { ParentsModule } from './parents/parents.module';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    // Global per-session safety-net limit; public auth endpoints declare
    // stricter per-client @Throttle overrides.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          name: 'default',
          ttl: 60_000,
          limit: config.get('THROTTLE_DEFAULT_LIMIT', { infer: true }),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    WorkspacesModule,
    AuditModule,
    StudentsModule,
    ParentsModule,
    TeachersModule,
    GroupsModule,
    EnrollmentsModule,
    SchedulingModule,
    PackagesModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    // Order matters: the throttler keys authenticated traffic on the session
    // that AccessTokenGuard attaches, so it must run after it.
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
  ],
})
export class AppModule {}
