'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import {
  STUDENT_FORM_SECTIONS,
  studentFormSchema,
  studentFormSectionStatus,
  type StudentFormValues,
} from '@/features/students/model/form';
import { useActiveSection } from '@/hooks/use-active-section';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { studentFormSectionId } from './student-form-sections';
import { useStudentFormNavItems } from './student-form-layout';

/** The student form, validated with the same localized messages everywhere. */
export function useStudentForm(defaultValues: StudentFormValues) {
  const tValidation = useTranslations('validation');
  return useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema, {
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

const SECTION_IDS = STUDENT_FORM_SECTIONS.map(({ id }) => studentFormSectionId(id));

/**
 * Everything the frame derives from the form: section status for the
 * navigation and progress, the section in view, and the counts the save bar
 * reports.
 */
export function useStudentFormState(form: UseFormReturn<StudentFormValues>) {
  const values = useWatch({ control: form.control }) as StudentFormValues;
  const { errors, dirtyFields } = form.formState;
  const errorFields = Object.keys(errors);
  const status = studentFormSectionStatus(values, errorFields);
  const navItems = useStudentFormNavItems(status);
  const [activeSection, setActiveSection] = useActiveSection(SECTION_IDS);
  const dirtyCount = Object.keys(dirtyFields).length;

  return {
    values,
    status,
    navItems,
    activeSection,
    setActiveSection,
    errorCount: errorFields.length,
    dirtyCount,
  };
}

/** Warns before the browser leaves a page with unsaved changes. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}
