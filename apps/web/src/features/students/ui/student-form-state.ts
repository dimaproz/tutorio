'use client';

import { useEffect, useRef } from 'react';
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

/**
 * Warns before a page with unsaved changes is left. The browser's own prompt
 * covers reloads and closing the tab; with `onNavigate`, an in-app link (the
 * sidebar, the tab bar, a breadcrumb) is held back and handed to the caller,
 * which asks first and navigates only on confirmation.
 */
export function useLeaveGuard(active: boolean, onNavigate?: (href: string) => void) {
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // Capture on the document runs before React's own listener on the root,
    // so a Next <Link> never starts its client navigation.
    const onClick = (event: MouseEvent) => {
      const handler = onNavigateRef.current;
      if (!handler || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handler(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);
}
