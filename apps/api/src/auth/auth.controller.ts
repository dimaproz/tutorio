import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodSerializerDto } from 'nestjs-zod';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import {
  ApiErrorDto,
  AuthMeDto,
  AuthSessionDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RegisterDto,
} from './dto/auth.dto';

// Limits are env-tunable so e2e suites can raise them; production defaults
// are 5 auth attempts and 20 refreshes per minute per client.
const AUTH_THROTTLE = {
  default: { limit: Number(process.env.THROTTLE_AUTH_LIMIT ?? 5), ttl: 60_000 },
};
const REFRESH_THROTTLE = {
  default: {
    limit: Number(process.env.THROTTLE_REFRESH_LIMIT ?? 20),
    ttl: 60_000,
  },
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates the user, their workspace, an OWNER membership and a session in one transaction.',
  })
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'EMAIL_TAKEN' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ZodSerializerDto(AuthSessionDto)
  register(@Body() dto: RegisterDto): Promise<AuthSessionDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Unknown email and wrong password return the same INVALID_CREDENTIALS response.',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'INVALID_CREDENTIALS',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ZodSerializerDto(AuthSessionDto)
  login(@Body() dto: LoginDto): Promise<AuthSessionDto> {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle(REFRESH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token',
    description:
      'Returns a new token pair. Replaying a previously rotated token revokes the session.',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({
    type: ApiErrorDto,
    description: 'INVALID_REFRESH_TOKEN or SESSION_EXPIRED',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @ZodSerializerDto(AuthSessionDto)
  refresh(@Body() dto: RefreshDto): Promise<AuthSessionDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke the session',
    description:
      'Idempotent — unknown or already revoked tokens still return 204.',
  })
  @ApiNoContentResponse({
    description: 'Session revoked (or was already invalid)',
  })
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the authenticated user, active workspace and role',
  })
  @ApiOkResponse({ type: AuthMeDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ZodSerializerDto(AuthMeDto)
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthMeDto> {
    return this.auth.me(user);
  }
}
