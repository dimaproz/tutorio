'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** The query parameter that opens the lesson panel on any page (S01 deep link). */
export const LESSON_PARAM = 'lesson';

/**
 * The lesson panel's own URL: `?lesson=<id>` on the page that opened it, so a
 * lesson can be linked to and the page stays underneath. Opening and closing
 * replace the entry instead of stacking history.
 */
export function useLessonPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const lessonId = params.get(LESSON_PARAM);

  const hrefWith = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (id) next.set(LESSON_PARAM, id);
      else next.delete(LESSON_PARAM);
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [params, pathname],
  );

  const open = useCallback(
    (id: string) => router.replace(hrefWith(id), { scroll: false }),
    [hrefWith, router],
  );
  const close = useCallback(
    () => router.replace(hrefWith(null), { scroll: false }),
    [hrefWith, router],
  );
  /** The absolute link to a lesson on this page, for "copy link". */
  const linkTo = useCallback(
    (id: string) => `${window.location.origin}${hrefWith(id)}`,
    [hrefWith],
  );

  return { lessonId, open, close, linkTo };
}
