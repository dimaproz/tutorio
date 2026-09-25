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
      'calendar',
      'lessons',
      'schedules',
      'students',
      'groups',
      'parents',
    ]);
    expect(
      isNavigationActive('/app/students/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e', items[3]!),
    ).toBe(true);
    expect(isNavigationActive('/app/groups', items[3]!)).toBe(false);
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
