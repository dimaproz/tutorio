import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { WorkspaceRole } from '@prisma/client';
import { durationToMs, type Env } from '../config/env';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types';

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = config.get('JWT_REFRESH_SECRET', { infer: true });
    this.accessTtl = config.get('JWT_ACCESS_TTL', { infer: true });
    this.refreshTtl = config.get('JWT_REFRESH_TTL', { infer: true });
    this.issuer = config.get('JWT_ISSUER', { infer: true });
    this.audience = config.get('JWT_AUDIENCE', { infer: true });
  }

  get refreshTtlMs(): number {
    return durationToMs(this.refreshTtl);
  }

  signAccessToken(input: {
    userId: string;
    sessionId: string;
    workspaceId: string;
    role: WorkspaceRole;
  }): string {
    const payload: AccessTokenPayload = {
      sub: input.userId,
      sid: input.sessionId,
      workspaceId: input.workspaceId,
      role: input.role,
      type: 'access',
    };
    return this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl as JwtSignOptions['expiresIn'],
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  signRefreshToken(input: {
    userId: string;
    sessionId: string;
    workspaceId: string;
    jti: string;
  }): string {
    const payload: RefreshTokenPayload = {
      sub: input.userId,
      sid: input.sessionId,
      workspaceId: input.workspaceId,
      type: 'refresh',
      jti: input.jti,
    };
    return this.jwt.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl as JwtSignOptions['expiresIn'],
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  // Throws on invalid signature, expiration, issuer, audience or token type.
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.accessSecret,
      issuer: this.issuer,
      audience: this.audience,
    });
    if (payload.type !== 'access') {
      throw new Error('Not an access token');
    }
    return payload;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.refreshSecret,
      issuer: this.issuer,
      audience: this.audience,
    });
    if (payload.type !== 'refresh') {
      throw new Error('Not a refresh token');
    }
    return payload;
  }

  // Only this HMAC is persisted — a database leak does not leak usable tokens.
  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.refreshSecret).update(token).digest('hex');
  }
}
