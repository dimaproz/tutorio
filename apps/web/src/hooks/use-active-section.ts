import * as React from 'react';

/**
 * The id of the section that currently owns the top of the viewport, for a
 * table of contents that follows scrolling. Falls back to the first id while
 * nothing has been observed yet (or where IntersectionObserver is missing).
 */
export function useActiveSection(ids: readonly string[]): [string, (id: string) => void] {
  const [active, setActive] = React.useState(ids[0] ?? '');
  const key = ids.join('|');

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        // The topmost visible section wins, in document order.
        const current = ids.find((id) => visible.has(id));
        if (current) setActive(current);
      },
      // A band across the upper part of the viewport: a section is current
      // once its top has scrolled into that band.
      { rootMargin: '-10% 0px -55% 0px' },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the id list
  }, [key]);

  return [active, setActive];
}
