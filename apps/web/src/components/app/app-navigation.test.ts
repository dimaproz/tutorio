import { describe, expect, it, vi } from 'vitest';
import {
  closeMobileNavigation,
  getNavigationItems,
  getRouteContext,
  getSettingsNavigation,
  isNavigationActive,
} from './app-navigation';

describe('application navigation', () => {
  it('lists the supported destinations in order and keeps detail routes active', () => {
    const items = getNavigationItems({ isOwner: true, isSolo: false });

    expect(items.map((item) => item.key)).toEqual([
      'dashboard',
      'calendar',
      'students',
      'groups',
      'parents',
      'teachers',
      'packages',
      'patterns',
    ]);
    expect(
      isNavigationActive('/app/students/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e', items[2]!),
    ).toBe(true);
    expect(isNavigationActive('/app', items[0]!)).toBe(true);
    expect(isNavigationActive('/app/students', items[0]!)).toBe(false);
  });

  it('hides teachers for SOLO workspaces and settings for non-owners', () => {
    const soloItems = getNavigationItems({ isOwner: true, isSolo: true });
    const schoolItems = getNavigationItems({ isOwner: false, isSolo: false });

    expect(soloItems.map((item) => item.key)).not.toContain('teachers');
    expect(schoolItems.map((item) => item.key)).toContain('teachers');
    expect(getSettingsNavigation({ isOwner: true, isSolo: true })?.key).toBe('settings');
    expect(getSettingsNavigation({ isOwner: false, isSolo: false })).toBeNull();
  });

  it('uses a neutral detail label instead of an identifier in route context', () => {
    expect(getRouteContext('/app/packages/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e')).toEqual([
      { key: 'packages', href: '/app/packages' },
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
