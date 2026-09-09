import type { ReactNode } from 'react';

export function NarrowStoryContainer({ children }: { children: ReactNode }) {
  return <div className="w-80 max-w-full">{children}</div>;
}
