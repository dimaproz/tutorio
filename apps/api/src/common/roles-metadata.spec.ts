import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { EnrollmentsController } from '../enrollments/enrollments.controller';
import { GroupsController } from '../groups/groups.controller';
import { StudentsController } from '../students/students.controller';
import { WorkspacesController } from '../workspaces/workspaces.controller';

// RolesGuard behavior is covered in auth/guards/guards.spec.ts; these tests
// prove every privileged Stage 2 endpoint actually declares the restriction.
describe('Stage 2 authorization metadata', () => {
  const reflector = new Reflector();

  function rolesOf(proto: object, method: string): string[] | undefined {
    const handler = Object.getOwnPropertyDescriptor(proto, method)?.value as
      (() => void) | undefined;
    expect(handler).toBeDefined();
    return reflector.get<string[]>(ROLES_KEY, handler as () => void);
  }

  it.each([
    ['students restore', StudentsController.prototype, 'restore'],
    ['groups restore', GroupsController.prototype, 'restore'],
    ['enrollments restore', EnrollmentsController.prototype, 'restore'],
    ['workspace settings', WorkspacesController.prototype, 'updateSettings'],
  ] as const)('%s is OWNER-only', (_label, proto, method) => {
    expect(rolesOf(proto, method)).toEqual(['OWNER']);
  });

  it.each([
    [
      'students CRUD',
      StudentsController.prototype,
      ['list', 'create', 'getDetail', 'update', 'softDelete'],
    ],
    [
      'groups CRUD',
      GroupsController.prototype,
      ['list', 'create', 'getDetail', 'update', 'softDelete'],
    ],
    [
      'enrollments CRUD',
      EnrollmentsController.prototype,
      ['list', 'create', 'getDetail', 'update', 'softDelete'],
    ],
    ['members roster', WorkspacesController.prototype, ['listMembers']],
  ] as const)('%s stays open to both roles', (_label, proto, methods) => {
    for (const method of methods) {
      expect(rolesOf(proto, method)).toBeUndefined();
    }
  });
});
