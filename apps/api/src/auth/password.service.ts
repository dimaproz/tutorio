import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';

// OWASP-recommended Argon2id parameters: 19 MiB memory, 2 iterations,
// 1 degree of parallelism. `algorithm: 2` is Algorithm.Argon2id — the package
// ships an ambient const enum that cannot be referenced with isolatedModules.
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
