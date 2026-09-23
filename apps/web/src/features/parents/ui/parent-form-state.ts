'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { SectionNavItem } from '@/components/shared/section-nav';
import {
  PARENT_FORM_SECTIONS,
  parentFormSchema,
  parentFormSectionStatus,
  type ParentFormSectionId,
  type ParentFormSectionStatus,
  type ParentFormValues,
} from '@/features/parents/model/form';
import { useActiveSection } from '@/hooks/use-active-section';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { PARENT_FORM_SECTION_ICON, parentFormSectionId } from './parent-form-sections';

/** The parent form, validated with the same localized messages everywhere. */
export function useParentForm(defaultValues: ParentFormValues) {
  const tValidation = useTranslations('validation');
  return useForm<ParentFormValues>({
    resolver: zodResolver(parentFormSchema, {
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

export function useParentFormNavItems(
  status?: Record<ParentFormSectionId, ParentFormSectionStatus>,
): SectionNavItem[] {
  const t = useTranslations('parents.form.sections');
  return PARENT_FORM_SECTIONS.map(({ id }) => ({
    id: parentFormSectionId(id),
    icon: PARENT_FORM_SECTION_ICON[id],
    title: t(`${id}.title`),
    description: t(`${id}.description`),
    status: status?.[id] ?? 'none',
  }));
}

const SECTION_IDS = PARENT_FORM_SECTIONS.map(({ id }) => parentFormSectionId(id));

/** Which sections hold a value, errors aside. */
const sectionFill = (values: ParentFormValues) => parentFormSectionStatus(values, []);

/**
 * Everything the frame derives from the form: section status for the
 * navigation and progress, the section in view, and the counts the save bar
 * reports.
 */
export function useParentFormState(form: UseFormReturn<ParentFormValues>) {
  // Re-render when a section flips between filled and empty, not on every
  // keystroke; errors re-render through formState. The status cannot change
  // in between, so the current values read below are always up to date.
  useWatch({ control: form.control, compute: sectionFill });
  const { errors, dirtyFields } = form.formState;
  const errorFields = Object.keys(errors);
  const status = parentFormSectionStatus(form.getValues(), errorFields);
  const navItems = useParentFormNavItems(status);
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
