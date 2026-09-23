'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FormPageLayout } from '@/components/shared/form-page-layout';
import { ProgressMeter } from '@/components/shared/progress-meter';
import type { SectionNavItem } from '@/components/shared/section-nav';
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
 * The student form's frame: the shared `FormPageLayout` with the student
 * labels and, on create, the progress meter under the navigation.
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

  return (
    <FormPageLayout
      title={title}
      subtitle={subtitle}
      headerAction={headerAction}
      navItems={navItems}
      activeSection={activeSection}
      onSelectSection={onSelectSection}
      labels={{
        sections: t('sectionsLabel'),
        error: t('sectionHasError'),
        done: t('sectionDone'),
      }}
      navNote={showProgress ? t('sectionsNote') : undefined}
      navAside={
        showProgress ? (
          <ProgressMeter
            value={done}
            total={navItems.length}
            label={t('progress', { done, total: navItems.length })}
            caption={t('progressReady')}
          />
        ) : undefined
      }
      navLoading={navLoading}
      notice={notice}
      bar={bar}
    >
      {children}
    </FormPageLayout>
  );
}
