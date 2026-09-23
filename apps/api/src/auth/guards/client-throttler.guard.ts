import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Env } from '../../config/env';
import type { AuthenticatedUser } from '../auth.types';

export const GATEWAY_SECRET_HEADER = 'x-gateway-secret';

export interface ThrottleTrackerRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: AuthenticatedUser;
}

export interface ThrottleTrackerOptions {
  // Shared secret the web gateway sends with every server-to-server call.
  gatewaySecret?: string;
  // Only outside production may an unsigned forwarded address be trusted.
  production: boolean;
}

function headerValue(
  headers: ThrottleTrackerRequest['headers'],
  name: string,
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function secretsMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Every browser request reaches the API through the Next.js gateway, so the
// socket address is the gateway's. The rate-limit bucket is therefore keyed
// on the authenticated session, or — for public routes such as login — on the
// client address the gateway forwards, but only when the gateway proves
// itself with the shared secret.
export function resolveThrottleTracker(
  req: ThrottleTrackerRequest,
  options: ThrottleTrackerOptions,
): string {
  if (req.user) {
    return `user:${req.user.sessionId || req.user.userId}`;
  }

  const forwarded = headerValue(req.headers, 'x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  if (forwarded) {
    const presented = headerValue(req.headers, GATEWAY_SECRET_HEADER);
    const trusted = options.gatewaySecret
      ? presented !== undefined &&
        secretsMatch(presented, options.gatewaySecret)
      : !options.production;
    if (trusted) {
      return `ip:${forwarded}`;
    }
  }
  return `ip:${req.ip ?? 'unknown'}`;
}

// Registered after AccessTokenGuard and RolesGuard so `req.user` is already
// set on authenticated routes; public routes still pass through it.
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  private readonly trackerOptions: ThrottleTrackerOptions;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    super(options, storageService, reflector);
    this.trackerOptions = {
      gatewaySecret: config.get('GATEWAY_SHARED_SECRET', { infer: true }),
      production: config.get('NODE_ENV', { infer: true }) === 'production',
    };
  }

  protected getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(
      resolveThrottleTracker(
        req as unknown as ThrottleTrackerRequest,
        this.trackerOptions,
      ),
    );
  }
}
