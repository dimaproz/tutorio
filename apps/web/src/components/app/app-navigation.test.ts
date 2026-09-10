import { describe, expect, it, vi } from 'vitest';
import {
  closeMobileNavigation,
  getNavigationGroups,
  getRouteContext,
  getSettingsNavigation,
  isNavigationActive,
} from './app-navigation';

describe('application navigation', () => {
  it('groups the supported destinations and keeps detail routes active', () => {
    const groups = getNavigationGroups({ isOwner: true, isSolo: false });

    expect(groups.map((group) => group.key)).toEqual(['main', 'people', 'management']);
    expect(groups[0]?.items.map((item) => item.key)).toEqual(['dashboard', 'calendar']);
    expect(isNavigationActive('/app/students/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e', groups[1]!.items[0]!)).toBe(true);
    expect(isNavigationActive('/app', groups[0]!.items[0]!)).toBe(true);
    expect(isNavigationActive('/app/students', groups[0]!.items[0]!)).toBe(false);
  });

  it('hides teachers for SOLO workspaces and settings for non-owners', () => {
    const soloItems = getNavigationGroups({ isOwner: true, isSolo: true }).flatMap(
      (group) => group.items,
    );
    const schoolItems = getNavigationGroups({ isOwner: false, isSolo: false }).flatMap(
      (group) => group.items,
    );

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
