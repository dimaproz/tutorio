'use client';

import { useEffect, useState } from 'react';

// Charts need to recolour when the lab flips themes. The theme lives as a
// `.dark` class on the document root (toggled by the shell), so watch that and
// re-render on change. Starts `false` to match the server render, then syncs
// on mount.
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setIsDark(root.classList.contains('dark'));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
