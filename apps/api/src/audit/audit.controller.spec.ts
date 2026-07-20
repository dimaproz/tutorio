import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { AuditController } from './audit.controller';

// The RolesGuard behavior itself is covered in auth/guards/guards.spec.ts;
// here we prove the audit endpoint actually declares the OWNER restriction.
describe('AuditController authorization metadata', () => {
  const reflector = new Reflector();

  it('restricts GET /audit-logs to OWNER', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- metadata lookup only, never invoked
    const listHandler = AuditController.prototype.list;
    const roles = reflector.get<string[]>(ROLES_KEY, listHandler);
    expect(roles).toEqual(['OWNER']);
  });

  it('exposes no mutation handlers (audit log is immutable)', () => {
    const handlers = Object.getOwnPropertyNames(
      AuditController.prototype,
    ).filter((name) => name !== 'constructor');
    expect(handlers).toEqual(['list']);
  });
});
