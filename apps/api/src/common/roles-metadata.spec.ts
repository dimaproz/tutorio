import { METHOD_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import type { Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { AppModule } from '../app.module';

type ControllerConstructor = Type<object> & {
  name: string;
  prototype: object;
};

type ModuleReference = Type<object> | { module?: Type<object> };

function moduleType(reference: ModuleReference): Type<object> | undefined {
  return typeof reference === 'function' ? reference : reference.module;
}

function registeredControllers(
  module: Type<object>,
  visited = new Set<Type<object>>(),
): ControllerConstructor[] {
  if (visited.has(module)) {
    return [];
  }
  visited.add(module);

  const controllers =
    (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) as
      ControllerConstructor[] | undefined) ?? [];
  const imports =
    (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) as
      ModuleReference[] | undefined) ?? [];

  return [
    ...controllers,
    ...imports.flatMap((importedModule) => {
      const nestedModule = moduleType(importedModule);
      return nestedModule ? registeredControllers(nestedModule, visited) : [];
    }),
  ];
}

// This manifest is the executable form of docs/api-permission-matrix.md. It
// must classify every controller route exactly once, so a new route cannot
// quietly inherit the default authenticated-member policy.
const publicRoutes = new Set([
  'AuthController.login',
  'AuthController.logout',
  'AuthController.refresh',
  'AuthController.register',
  'HealthController.check',
]);

const selfRoutes = new Set([
  'AuthController.me',
  'WorkspacesController.getCurrent',
]);

const ownerRoutes = new Set([
  'AuditController.list',
  'EnrollmentsController.create',
  'EnrollmentsController.getDetail',
  'EnrollmentsController.list',
  'EnrollmentsController.restore',
  'EnrollmentsController.softDelete',
  'EnrollmentsController.update',
  'GroupsController.create',
  'GroupsController.getDetail',
  'GroupsController.list',
  'GroupsController.restore',
  'GroupsController.softDelete',
  'GroupsController.update',
  'LessonsController.create',
  'LessonsController.list',
  'LessonsController.remove',
  'LessonsController.reschedule',
  'LessonsController.transition',
  'LessonsController.update',
  'PackagesController.adjust',
  'PackagesController.create',
  'PackagesController.getDetail',
  'PackagesController.getLedger',
  'PackagesController.list',
  'PackagesController.remove',
  'ParentsController.create',
  'ParentsController.getDetail',
  'ParentsController.list',
  'ParentsController.remove',
  'ParentsController.update',
  'PaymentsController.list',
  'PaymentsController.record',
  'SeriesController.create',
  'SeriesController.getDetail',
  'SeriesController.list',
  'SeriesController.remove',
  'SeriesController.update',
  'StudentsController.create',
  'StudentsController.getDetail',
  'StudentsController.list',
  'StudentsController.remove',
  'StudentsController.removePermanently',
  'StudentsController.restore',
  'StudentsController.update',
  'TeachersController.create',
  'TeachersController.getDetail',
  'TeachersController.list',
  'TeachersController.remove',
  'TeachersController.restore',
  'TeachersController.update',
  'WorkspacesController.listMembers',
  'WorkspacesController.updateSettings',
]);

function routedMethods(controller: ControllerConstructor) {
  return Object.getOwnPropertyNames(controller.prototype)
    .filter((method) => method !== 'constructor')
    .filter((method) => {
      const handler = Object.getOwnPropertyDescriptor(
        controller.prototype,
        method,
      )?.value;
      return Reflect.getMetadata(METHOD_METADATA, handler) !== undefined;
    })
    .map((method) => ({
      id: `${controller.name}.${method}`,
      controller,
      method,
      handler: Object.getOwnPropertyDescriptor(controller.prototype, method)
        ?.value as () => void,
    }));
}

describe('Pilot authorization metadata', () => {
  const reflector = new Reflector();
  const routes = registeredControllers(AppModule).flatMap(routedMethods);
  const classifiedRoutes = new Set([
    ...publicRoutes,
    ...selfRoutes,
    ...ownerRoutes,
  ]);

  it('enumerates and classifies every controller route exactly once', () => {
    expect(routes.map((route) => route.id).sort()).toEqual(
      [...classifiedRoutes].sort(),
    );
    expect(classifiedRoutes.size).toBe(
      publicRoutes.size + selfRoutes.size + ownerRoutes.size,
    );
  });

  it.each(routes)('$id declares its pilot access policy', (route) => {
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      route.handler,
      route.controller,
    ]);
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      route.handler,
      route.controller,
    ]);

    if (publicRoutes.has(route.id)) {
      expect(isPublic).toBe(true);
      expect(roles).toBeUndefined();
      return;
    }

    if (selfRoutes.has(route.id)) {
      expect(isPublic).toBeUndefined();
      expect(roles).toBeUndefined();
      return;
    }

    expect(ownerRoutes.has(route.id)).toBe(true);
    expect(isPublic).toBeUndefined();
    expect(roles).toEqual(['OWNER']);
  });
});
