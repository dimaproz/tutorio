import { describe, expect, it, vi } from 'vitest';
import {
  canUseBusinessRoutes,
  closeMobileNavigation,
  getNavigationItems,
  getRouteContext,
  isNavigationActive,
} from './app-navigation';

describe('application navigation', () => {
  it('lists the rebuilt destinations in order and keeps detail routes active', () => {
    const items = getNavigationItems({ isOwner: true, isSolo: false });

    expect(items.map((item) => item.key)).toEqual([
      'today',
      'calendar',
      'lessons',
      'schedules',
      'packages',
      'students',
      'groups',
      'parents',
      'teachers',
      'settings',
    ]);
    expect(
      isNavigationActive('/app/students/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e', items[5]!),
    ).toBe(true);
    expect(isNavigationActive('/app/groups', items[5]!)).toBe(false);
  });

  it('opens on «Сьогодні», active on /app only', () => {
    const today = getNavigationItems({ isOwner: true, isSolo: true })[0]!;
    expect(today.key).toBe('today');
    expect(isNavigationActive('/app', today)).toBe(true);
    expect(isNavigationActive('/app/students', today)).toBe(false);
    expect(getRouteContext('/app')).toEqual([{ key: 'today', href: '/app' }]);
  });

  it('shows the teachers to a studio only', () => {
    const solo = getNavigationItems({ isOwner: true, isSolo: true }).map((item) => item.key);
    expect(solo).not.toContain('teachers');
    expect(getRouteContext('/app/teachers/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e')).toEqual([
      { key: 'teachers', href: '/app/teachers' },
      { key: 'detail' },
    ]);
  });

  it('offers the settings to an owner in both modes, each area a detail of them', () => {
    const solo = getNavigationItems({ isOwner: true, isSolo: true }).map((item) => item.key);
    expect(solo.at(-1)).toBe('settings');
    expect(getRouteContext('/app/settings')).toEqual([{ key: 'settings', href: '/app/settings' }]);
    expect(getRouteContext('/app/settings/audit')).toEqual([
      { key: 'settings', href: '/app/settings' },
      { key: 'detail' },
    ]);
  });

  it('gives a non-owner no destinations at all, matching the owner-only API', () => {
    expect(getNavigationItems({ isOwner: false, isSolo: false })).toEqual([]);
    expect(canUseBusinessRoutes('OWNER')).toBe(true);
    expect(canUseBusinessRoutes('TEACHER')).toBe(false);
  });

  it('uses a neutral detail label instead of an identifier in route context', () => {
    expect(getRouteContext('/app/groups/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e')).toEqual([
      { key: 'groups', href: '/app/groups' },
      { key: 'detail' },
    ]);
  });

  it('closes only the mobile Sheet after a navigation selection', () => {
    const setOpenMobile = vi.fn();

    closeMobileNavigation(false, setOpenMobile);
    expect(setOpenMobile).not.toHaveBeenCalled();

    closeMobileNavigation(true, setOpenMobile);
    expect(setOpenMobile).toHaveBeenCalledWith(false);
  });
});
