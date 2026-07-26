'use client';

import type { FieldErrors } from 'react-hook-form';

/**
 * Scrolls the first invalid field into view after a failed submit.
 *
 * react-hook-form focuses the first error on its own, but only for fields it
 * registered a DOM ref for — our composed controls (`EntityPicker`,
 * `DatePicker`, `WeekdayPicker`) are `Controller`-driven and have no ref, so a
 * long form would silently do nothing on submit. Matching on the rendered
 * `[data-invalid]` marker covers every field type uniformly.
 */
export function scrollToFirstError(errors: FieldErrors): void {
  if (Object.keys(errors).length === 0) {
    return;
  }
  // Deferred so the invalid markers are painted before we look for them.
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(
      '[data-invalid="true"], [aria-invalid="true"]',
    );
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Focus what the tutor has to fix, when it can take focus.
    const focusable = target.matches('input,select,textarea,button')
      ? target
      : target.querySelector<HTMLElement>('input,select,textarea,button');
    focusable?.focus({ preventScroll: true });
  });
}
