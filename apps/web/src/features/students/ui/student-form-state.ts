'use client';

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

/** Which sections hold a value, errors aside. */
const sectionFill = (values: StudentFormValues) => studentFormSectionStatus(values, []);

/**
 * Everything the frame derives from the form: section status for the
 * navigation and progress, the section in view, and the counts the save bar
 * reports.
 */
export function useStudentFormState(form: UseFormReturn<StudentFormValues>) {
  // A whole-form watch here re-rendered every section on every keystroke. The
  // page re-renders when a section flips between filled and empty, and on
  // error changes through formState; the status cannot change in between, so
  // the current values read below are always up to date.
  useWatch({ control: form.control, compute: sectionFill });
  const { errors, dirtyFields } = form.formState;
  const errorFields = Object.keys(errors);
  const status = studentFormSectionStatus(form.getValues(), errorFields);
  const navItems = useStudentFormNavItems(status);
  const [activeSection, setActiveSection] = useActiveSection(SECTION_IDS);
  const dirtyCount = Object.keys(dirtyFields).length;

  return {
    status,
    navItems,
    activeSection,
    setActiveSection,
    errorCount: errorFields.length,
    dirtyCount,
  };
}
