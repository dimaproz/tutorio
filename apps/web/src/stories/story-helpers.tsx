import type { ReactNode } from 'react';
import { NextIntlClientProvider, useLocale, useMessages, useTimeZone } from 'next-intl';
import { GLYPH_NAMES, Glyph, type GlyphName } from '@/components/shared/glyph';
import { MOBILE_MEDIA_QUERY } from '@/hooks/use-mobile';

export function NarrowStoryContainer({ children }: { children: ReactNode }) {
  return <div className="w-80 max-w-full">{children}</div>;
}

/** A Storybook select over the design's glyph names; `none` means no icon. */
export const glyphControl = {
  control: 'select',
  options: ['none', ...GLYPH_NAMES],
} as const;

/** Renders a glyph arg as an icon, or nothing for `none`. */
export function glyphNode(name: GlyphName | 'none' | undefined) {
  return name && name !== 'none' ? <Glyph name={name} /> : undefined;
}

/**
 * Makes `useIsMobile()` report a phone for the duration of a story, so a
 * story can exercise the sheet and drawer branches at any canvas width.
 * Returns the cleanup that restores the real media query.
 */
export function forceMobileMediaQuery() {
  const originalMatchMedia = window.matchMedia;

  window.matchMedia = (query) => {
    const result = originalMatchMedia(query);
    if (query !== MOBILE_MEDIA_QUERY) return result;
    return {
      ...result,
      matches: true,
      addEventListener: result.addEventListener.bind(result),
      removeEventListener: result.removeEventListener.bind(result),
      dispatchEvent: result.dispatchEvent.bind(result),
    };
  };

  return () => {
    window.matchMedia = originalMatchMedia;
  };
}

/** Storybook viewport globals for the handoff's two frame widths. */
export const MOBILE_VIEWPORT = { viewport: { value: 'handoffMobile', isRotated: false } } as const;
export const DESKTOP_VIEWPORT = {
  viewport: { value: 'handoffDesktop', isRotated: false },
} as const;

/**
 * Moves a story's clock: the same locale, messages and time zone as the
 * preview decorator, with another `now` for every `useNow()` below it.
 */
export function StoryClock({ now, children }: { now: number; children: ReactNode }) {
  const locale = useLocale();
  const messages = useMessages();
  const timeZone = useTimeZone();
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
      now={new Date(now)}
    >
      {children}
    </NextIntlClientProvider>
  );
}
