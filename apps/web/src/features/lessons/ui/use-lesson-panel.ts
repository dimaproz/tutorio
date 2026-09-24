'use client';

import { useCallback, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUpdateSearchParams } from '@/components/shared/list-controls';

/** The query parameter that opens the lesson panel on any page (S01 deep link). */
export const LESSON_PARAM = 'lesson';

/** A command the panel runs as soon as the lesson has loaded. */
export type LessonPanelIntent = 'markAttendance';

/**
 * The lesson panel's own URL: `?lesson=<id>` on the page that opened it, so a
 * lesson can be linked to and the page stays underneath. Opening and closing
 * replace the entry instead of stacking history, through native history: the
 * panel reads its lesson on the client, so the server has nothing to render.
 */
export function useLessonPanel() {
  const updateParams = useUpdateSearchParams();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get(LESSON_PARAM);
  // The panel opens at once and the URL follows; a URL that changes on its
  // own (back, forward, a link) wins again. The intent is not in the URL: it
  // survives the URL catching up with this lesson and nothing else.
  const [state, setState] = useState<{
    url: string | null;
    lessonId: string | null;
    intent: LessonPanelIntent | null;
  }>({ url: fromUrl, lessonId: fromUrl, intent: null });
  if (state.url !== fromUrl) {
    setState({
      url: fromUrl,
      lessonId: fromUrl,
      intent: fromUrl === state.lessonId ? state.intent : null,
    });
  }
  const { lessonId, intent } = state;

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
    (id: string, nextIntent: LessonPanelIntent | null = null) => {
      setState((current) => ({ ...current, lessonId: id, intent: nextIntent }));
      updateParams({ [LESSON_PARAM]: id });
    },
    [updateParams],
  );
  const close = useCallback(() => {
    setState((current) => ({ ...current, lessonId: null, intent: null }));
    updateParams({ [LESSON_PARAM]: undefined });
  }, [updateParams]);
  /** The absolute link to a lesson on this page, for "copy link". */
  const linkTo = useCallback(
    (id: string) => `${window.location.origin}${hrefWith(id)}`,
    [hrefWith],
  );

  return { lessonId, intent, open, close, linkTo };
}
