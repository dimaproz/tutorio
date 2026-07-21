'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GraduationCapIcon } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { cn } from '@/lib/utils';

// TailAdmin's left rail: a brand lockup on top, a small section label, then a
// vertical nav where the active item is a brand-tinted pill. Rendered fixed on
// desktop and inside a Sheet on mobile (see design-shell).
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const params = useSearchParams();
  const section = params.get('section');
  const active = NAV_ITEMS.some((item) => item.key === section) ? section : 'overview';

  return (
    <div className="bg-sidebar border-sidebar-border flex h-full w-[290px] flex-col border-r">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg">
          <GraduationCapIcon className="size-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Tutorio</span>
      </div>

      <nav aria-label="Розділи лабораторії" className="flex flex-col gap-2 px-4 py-4">
        <span className="text-muted-foreground px-2 text-xs font-medium tracking-wider uppercase">
          Меню
        </span>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <li key={item.key}>
                <Link
                  href={`/design?section=${item.key}`}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'focus-visible:ring-ring flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <item.icon className="size-5 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto p-4">
        <div className="bg-accent text-muted-foreground rounded-2xl p-4 text-xs leading-relaxed">
          Дизайн-лабораторія Tutorio. Компоненти й патерни продукту в одному стилі.
        </div>
      </div>
    </div>
  );
}
