'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/page-shell';
import { ProgressMeter } from '@/components/shared/progress-meter';
import { SectionChips, SectionNav, type SectionNavItem } from '@/components/shared/section-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { PARENT_FORM_SECTIONS } from '@/features/parents/model/form';

/**
 * The full-page parent form frame: page header, the 280px section navigation
 * (chips on phones) with the progress meter, the section column and the save
 * bar. It owns layout only; the form, its states and its commands are the
 * caller's.
 */
export function ParentFormLayout({
  title,
  subtitle,
  navItems,
  activeSection,
  onSelectSection,
  progressCaption,
  navNote,
  navLoading = false,
  notice,
  children,
  bar,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  navItems: SectionNavItem[];
  activeSection?: string;
  onSelectSection?: (id: string) => void;
  /** Shows how much is filled in under the navigation. */
  progressCaption?: ReactNode;
  navNote?: ReactNode;
  /** Replaces the navigation with its skeleton while the record loads. */
  navLoading?: boolean;
  /** Banner above the sections, e.g. a request error. */
  notice?: ReactNode;
  children: ReactNode;
  bar?: ReactNode;
}) {
  const t = useTranslations('parents.form');
  const done = navItems.filter((item) => item.status === 'done').length;
  const labels = { errorLabel: t('sectionHasError'), doneLabel: t('sectionDone') };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader size="lg" title={title} description={subtitle} />

      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 py-2 md:hidden">
        <SectionChips
          label={t('sectionsLabel')}
          items={navItems}
          active={activeSection}
          onSelect={onSelectSection}
          {...labels}
        />
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-6 hidden flex-col gap-4 md:flex">
          {navLoading ? (
            <div aria-hidden="true" className="flex flex-col gap-1">
              {PARENT_FORM_SECTIONS.map(({ id }) => (
                <div key={id} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="size-8 rounded-[10px] bg-secondary" />
                  <div className="flex grow flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-32 bg-secondary" />
                    <Skeleton className="h-3 w-24 bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SectionNav
              label={t('sectionsLabel')}
              items={navItems}
              active={activeSection}
              onSelect={onSelectSection}
              note={navNote}
              {...labels}
            />
          )}
          {progressCaption && !navLoading ? (
            <ProgressMeter
              value={done}
              total={navItems.length}
              label={t('progress', { done, total: navItems.length })}
              caption={progressCaption}
            />
          ) : null}
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
