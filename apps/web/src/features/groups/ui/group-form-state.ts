'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { SectionNavItem } from '@/components/shared/section-nav';
import {
  GROUP_FORM_SECTIONS,
  groupFormSectionStatus,
  makeGroupFormSchema,
  type GroupFormSectionId,
  type GroupFormSectionStatus,
  type GroupFormValues,
} from '@/features/groups/model/form';
import { useActiveSection } from '@/hooks/use-active-section';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { GROUP_FORM_SECTION_ICON, groupFormSectionId } from './group-form-sections';

/**
 * The group form, validated with the same localized messages everywhere. In a
 * school the teacher is required before students or a schedule; a solo
 * tutor's own teacher profile is used without asking.
 */
export function useGroupForm(defaults: GroupFormValues, { teacherRequired }: { teacherRequired: boolean }) {
  const tValidation = useTranslations('validation');
  return useForm<GroupFormValues>({
    resolver: zodResolver(makeGroupFormSchema({ teacherRequired }), {
      errorMap: makeZodErrorMap(tValidation, {
        name: { tooSmall: 'groupNameRequired', tooBig: 'groupNameTooLong' },
      }),
      path: [],
      async: true,
    }),
    defaultValues: defaults,
    // Errors appear on submit, then follow the field as it is corrected.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
}

export function useGroupFormNavItems(
  status?: Record<GroupFormSectionId, GroupFormSectionStatus>,
): SectionNavItem[] {
  const t = useTranslations('groups.form.sections');
  return GROUP_FORM_SECTIONS.map(({ id }) => ({
    id: groupFormSectionId(id),
    icon: GROUP_FORM_SECTION_ICON[id],
    title: t(`${id}.title`),
    description: t(`${id}.description`),
    status: status?.[id] ?? 'none',
  }));
}

const SECTION_IDS = GROUP_FORM_SECTIONS.map(({ id }) => groupFormSectionId(id));

/**
 * Everything the frame derives from the form: section status for the
 * navigation and progress, the section in view, and the counts the save bar
 * reports.
 */
export function useGroupFormState(
  form: UseFormReturn<GroupFormValues>,
  { scheduleLocked = false }: { scheduleLocked?: boolean } = {},
) {
  // Re-render when a section flips between filled and empty, not on every
  // keystroke; errors re-render through formState.
  useWatch({
    control: form.control,
    compute: (values: GroupFormValues) =>
      groupFormSectionStatus(values, [], { scheduleLocked }),
  });
  const { errors, dirtyFields } = form.formState;
  const errorFields = Object.keys(errors);
  const status = groupFormSectionStatus(form.getValues(), errorFields, { scheduleLocked });
  const navItems = useGroupFormNavItems(status);
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
