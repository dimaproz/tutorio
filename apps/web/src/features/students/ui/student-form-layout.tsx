'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/shared/page-shell';
import { ProgressMeter } from '@/components/shared/progress-meter';
import { SectionChips, SectionNav, type SectionNavItem } from '@/components/shared/section-nav';
import { Skeleton } from '@/components/ui/skeleton';
import {
  STUDENT_FORM_SECTIONS,
  type StudentFormSectionId,
  type StudentFormSectionStatus,
} from '@/features/students/model/form';
import { STUDENT_FORM_SECTION_ICON, studentFormSectionId } from './student-form-sections';

export function useStudentFormNavItems(
  status?: Record<StudentFormSectionId, StudentFormSectionStatus>,
): SectionNavItem[] {
  const t = useTranslations('students.form.sections');
  return STUDENT_FORM_SECTIONS.map(({ id }) => ({
    id: studentFormSectionId(id),
    icon: STUDENT_FORM_SECTION_ICON[id],
    title: t(`${id}.title`),
    description: t(`${id}.description`),
    status: status?.[id] ?? 'none',
  }));
}

/**
 * The full-page form frame: page header, the 280px section navigation (chips
 * on phones), the section column and the save bar. It owns layout only; the
 * form, its states and its commands are the caller's.
 */
export function StudentFormLayout({
  title,
  subtitle,
  headerAction,
  navItems,
  activeSection,
  onSelectSection,
  showProgress = false,
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
  /** Create mode shows how much is filled in under the navigation. */
  showProgress?: boolean;
  /** Replaces the navigation with its skeleton while the record loads. */
  navLoading?: boolean;
  /** Banner above the sections: a request error or the archived state. */
  notice?: ReactNode;
  children: ReactNode;
  bar?: ReactNode;
}) {
  const t = useTranslations('students.form');
  const done = navItems.filter((item) => item.status === 'done').length;
  const labels = { errorLabel: t('sectionHasError'), doneLabel: t('sectionDone') };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader size="lg" title={title} description={subtitle} action={headerAction} />

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
          {navLoading ? <StudentFormNavSkeleton /> : null}
          {navLoading ? null : (
            <SectionNav
              label={t('sectionsLabel')}
              items={navItems}
              active={activeSection}
              onSelect={onSelectSection}
              note={showProgress ? t('sectionsNote') : undefined}
              {...labels}
            />
          )}
          {showProgress ? (
            <ProgressMeter
              value={done}
              total={navItems.length}
              label={t('progress', { done, total: navItems.length })}
              caption={t('progressReady')}
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

/** The navigation column while the record loads. */
export function StudentFormNavSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-1">
      {STUDENT_FORM_SECTIONS.map(({ id }) => (
        <div key={id} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-8 rounded-[10px] bg-secondary" />
          <div className="flex grow flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32 bg-secondary" />
            <Skeleton className="h-3 w-24 bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
