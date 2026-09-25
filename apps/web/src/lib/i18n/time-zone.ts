'use client';

import { useTimeZone } from 'next-intl';
import { DEFAULT_TIME_ZONE } from '@/lib/datetime';

/**
 * The studio's IANA zone (`Workspace.timezone`): the clock every date and
 * time in the product is typed and read on. The session provider hands it to
 * next-intl, so formatting and this hook agree; before a session is known
 * (sign-in) it is the default studio zone.
 */
export function useStudioTimeZone(): string {
  return useTimeZone() ?? DEFAULT_TIME_ZONE;
}
