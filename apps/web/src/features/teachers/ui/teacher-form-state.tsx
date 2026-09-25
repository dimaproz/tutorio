'use client';

import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileTextIcon, GraduationCapIcon, PhoneIcon, UserIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { FormPageLayout } from '@/components/shared/form-page-layout';
import { ProgressMeter } from '@/components/shared/progress-meter';
import type { SectionNavItem } from '@/components/shared/section-nav';
import { useActiveSection } from '@/hooks/use-active-section';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import {
  TEACHER_FORM_SECTIONS,
  teacherFormSchema,
  teacherFormSectionStatus,
  type TeacherFormSectionId,
  type TeacherFormSectionStatus,
  type TeacherFormValues,
} from '../model/form';

export const TEACHER_FORM_SECTION_ICON: Record<TeacherFormSectionId, ReactNode> = {
  identity: <UserIcon />,
  contacts: <PhoneIcon />,
  teaching: <GraduationCapIcon />,
  about: <FileTextIcon />,
};

export function teacherFormSectionId(id: TeacherFormSectionId) {
  return `teacher-form-${id}`;
}

/** The teacher form, validated with the same localized messages everywhere. */
export function useTeacherForm(defaultValues: TeacherFormValues) {
  const tValidation = useTranslations('validation');
  return useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues,
    // Errors appear on submit, then follow the field as it is corrected.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
}

export function useTeacherFormNavItems(
  status?: Record<TeacherFormSectionId, TeacherFormSectionStatus>,
): SectionNavItem[] {
  const t = useTranslations('teachers.form.sections');
  return TEACHER_FORM_SECTIONS.map(({ id }) => ({
    id: teacherFormSectionId(id),
    icon: TEACHER_FORM_SECTION_ICON[id],
    title: id === 'about' ? t('about.navTitle') : t(`${id}.title`),
    description: id === 'about' ? t('about.navDescription') : t(`${id}.description`),
    status: status?.[id] ?? 'none',
  }));
}

const SECTION_IDS = TEACHER_FORM_SECTIONS.map(({ id }) => teacherFormSectionId(id));

/** Which sections hold a value, errors aside. */
const sectionFill = (values: TeacherFormValues) => teacherFormSectionStatus(values, []);

/**
 * Everything the frame derives from the form: section status for the
 * navigation and progress, the section in view, and the counts the save bar
 * reports.
 */
export function useTeacherFormState(form: UseFormReturn<TeacherFormValues>) {
  // Re-render when a section flips between filled and empty, not on every
  // keystroke; errors re-render through formState.
  useWatch({ control: form.control, compute: sectionFill });
  const { errors, dirtyFields } = form.formState;
  const errorFields = Object.keys(errors);
  const status = teacherFormSectionStatus(form.getValues(), errorFields);
  const navItems = useTeacherFormNavItems(status);
  const [activeSection, setActiveSection] = useActiveSection(SECTION_IDS);

  return {
    status,
    navItems,
    activeSection,
    setActiveSection,
    errorCount: errorFields.length,
    dirtyCount: Object.keys(dirtyFields).length,
  };
}

/**
 * The teacher form's frame: the shared `FormPageLayout` with the teacher
 * labels, and on create the progress meter under the navigation (as on the
 * student form).
 */
export function TeacherFormLayout({
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
  /** Shows how much is filled in under the navigation (create only). */
  progressCaption?: ReactNode;
  navNote?: ReactNode;
  navLoading?: boolean;
  notice?: ReactNode;
  children: ReactNode;
  bar?: ReactNode;
}) {
  const t = useTranslations('teachers.form');
  const done = navItems.filter((item) => item.status === 'done').length;

  return (
    <FormPageLayout
      title={title}
      subtitle={subtitle}
      navItems={navItems}
      activeSection={activeSection}
      onSelectSection={onSelectSection}
      labels={{
        sections: t('sectionsLabel'),
        error: t('sectionHasError'),
        done: t('sectionDone'),
      }}
      navNote={navNote}
      navAside={
        progressCaption ? (
          <ProgressMeter
            value={done}
            total={navItems.length}
            label={t('progress', { done, total: navItems.length })}
            caption={progressCaption}
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
