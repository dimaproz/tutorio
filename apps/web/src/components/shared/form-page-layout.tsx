import type { ReactNode } from 'react';
import { PageHeader } from '@/components/shared/page-shell';
import { SectionChips, SectionNav, type SectionNavItem } from '@/components/shared/section-nav';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The frame of a full-page entity form: the page header, the 280px section
 * navigation (chips on phones) with an optional block under it, the section
 * column and the save bar. It owns layout only; the form, its states, its
 * commands and every label are the caller's.
 */
export function FormPageLayout({
  title,
  subtitle,
  headerAction,
  navItems,
  activeSection,
  onSelectSection,
  labels,
  navNote,
  navAside,
  navLoading = false,
  notice,
  children,
  bar,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  headerAction?: ReactNode;
  navItems: SectionNavItem[];
  activeSection?: string;
  onSelectSection?: (id: string) => void;
  /** The navigation's name and the status words its marks announce. */
  labels: { sections: string; error: string; done: string };
  /** A line under the navigation, e.g. which fields are required. */
  navNote?: ReactNode;
  /** A block under the navigation, e.g. a `ProgressMeter`. */
  navAside?: ReactNode;
  /** Replaces the navigation with its skeleton while the record loads. */
  navLoading?: boolean;
  /** Banner above the sections: a request error or a read-only state. */
  notice?: ReactNode;
  children: ReactNode;
  bar?: ReactNode;
}) {
  const marks = { errorLabel: labels.error, doneLabel: labels.done };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader size="lg" title={title} description={subtitle} action={headerAction} />

      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 py-2 md:hidden">
        <SectionChips
          label={labels.sections}
          items={navItems}
          active={activeSection}
          onSelect={onSelectSection}
          {...marks}
        />
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-6 hidden flex-col gap-4 md:flex">
          {navLoading ? (
            <div aria-hidden="true" className="flex flex-col gap-1">
              {navItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="size-8 rounded-control bg-secondary" />
                  <div className="flex grow flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-32 bg-secondary" />
                    <Skeleton className="h-3 w-24 bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SectionNav
              label={labels.sections}
              items={navItems}
              active={activeSection}
              onSelect={onSelectSection}
              note={navNote}
              {...marks}
            />
          )}
          {navLoading ? null : navAside}
        </aside>
        <div className="flex min-w-0 flex-col gap-4">
          {notice}
          {children}
        </div>
      </div>

      {bar ? (
        <>
          {/* Keeps the last section clear of the floating bar. */}
          <div aria-hidden="true" className="h-4" />
          {bar}
        </>
      ) : null}
    </div>
  );
}
