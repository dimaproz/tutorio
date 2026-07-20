import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

// Secrets and TTLs are passed per sign/verify call by TokenService, so the
// JwtModule itself carries no configuration (access and refresh tokens use
// different secrets).
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, PasswordService],
  exports: [TokenService],
})
export class AuthModule {}
