'use client';

import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { UsersRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormSection } from '@/components/app/form-section';
import { EntityPicker } from '@/components/shared';
import type {
  LessonFormValues,
  LessonTarget,
  PersonOption,
} from '@/features/scheduling/model/lesson-form';

/**
 * Who the lesson is for. A lesson is booked either against a student or against
 * a whole group, and the two are mutually exclusive on the API — hence tabs
 * rather than two pickers the tutor could fill in at once.
 */
export function LessonTargetSection({
  studentOptions,
  groupOptions,
  teacherOptions,
  isLoadingStudents,
  isLoadingGroups,
  isLoadingTeachers,
  lockedStudentId,
  lockedGroupId,
  onTargetChange,
  onStudentChange,
  onGroupChange,
  onTeacherChange,
}: {
  studentOptions: PersonOption[];
  groupOptions: PersonOption[];
  teacherOptions: PersonOption[];
  isLoadingStudents: boolean;
  isLoadingGroups: boolean;
  isLoadingTeachers: boolean;
  /** Set when opened from a student page — the target is fixed. */
  lockedStudentId?: string;
  /** Set when opened from a group page — the target is fixed. */
  lockedGroupId?: string;
  onTargetChange: (target: LessonTarget) => void;
  onStudentChange: (studentId: string) => void;
  onGroupChange: (groupId: string) => void;
  onTeacherChange: (teacherId: string) => void;
}) {
  const t = useTranslations('scheduling.lessonForm');
  const form = useFormContext<LessonFormValues>();
  const { errors } = form.formState;
  const target = useWatch({ control: form.control, name: 'target' });

  return (
    <FormSection
      icon={UsersRoundIcon}
      title={t('lessonType')}
      description={t('lessonTypeHint')}
      tone="primary"
    >
      {!lockedStudentId && !lockedGroupId ? (
        <Controller
          control={form.control}
          name="target"
          render={({ field }) => (
            <Tabs
              className="w-full"
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                onTargetChange(value as LessonTarget);
              }}
            >
              <TabsList variant="segmented" size="default" className="grid w-full grid-cols-2">
                <TabsTrigger value="student" className="w-full">
                  {t('targetStudent')}
                </TabsTrigger>
                <TabsTrigger value="group" className="w-full">
                  {t('targetGroup')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />
      ) : null}

      {!lockedStudentId && !lockedGroupId && target === 'student' ? (
        <Controller
          control={form.control}
          name="studentId"
          render={({ field }) => (
            <Field data-invalid={errors.studentId ? true : undefined}>
              <FieldLabel htmlFor="lesson-student" className="sr-only">
                {t('student')}
              </FieldLabel>
              <EntityPicker
                id="lesson-student"
                value={field.value}
                options={studentOptions}
                onChange={(value) => {
                  field.onChange(value ?? '');
                  onStudentChange(value ?? '');
                }}
                placeholder={t('studentPlaceholder')}
                searchPlaceholder={t('studentSearch')}
                emptyLabel={t('studentEmpty')}
                invalid={Boolean(errors.studentId)}
                isLoading={isLoadingStudents}
              />
              <FieldError errors={[errors.studentId]} />
            </Field>
          )}
        />
      ) : null}

      {!lockedStudentId && !lockedGroupId && target === 'group' ? (
        <Controller
          control={form.control}
          name="groupId"
          render={({ field }) => (
            <Field data-invalid={errors.groupId ? true : undefined}>
              <FieldLabel htmlFor="lesson-group" className="sr-only">
                {t('group')}
              </FieldLabel>
              <EntityPicker
                id="lesson-group"
                value={field.value}
                options={groupOptions}
                onChange={(value) => {
                  field.onChange(value ?? '');
                  onGroupChange(value ?? '');
                }}
                placeholder={t('groupPlaceholder')}
                searchPlaceholder={t('groupSearch')}
                emptyLabel={t('groupEmpty')}
                invalid={Boolean(errors.groupId)}
                isLoading={isLoadingGroups}
              />
              <FieldError errors={[errors.groupId]} />
            </Field>
          )}
        />
      ) : null}

      {/* One teacher in the workspace: nothing to choose. */}
      {teacherOptions.length > 1 ? (
        <Controller
          control={form.control}
          name="teacherId"
          render={({ field }) => (
            <Field data-invalid={errors.teacherId ? true : undefined}>
              <FieldLabel htmlFor="lesson-teacher">{t('teacher')}</FieldLabel>
              <EntityPicker
                id="lesson-teacher"
                value={field.value}
                options={teacherOptions}
                onChange={(value) => {
                  field.onChange(value ?? '');
                  onTeacherChange(value ?? '');
                }}
                placeholder={t('teacherPlaceholder')}
                searchPlaceholder={t('teacherSearch')}
                emptyLabel={t('teacherEmpty')}
                invalid={Boolean(errors.teacherId)}
                isLoading={isLoadingTeachers}
              />
              <FieldError errors={[errors.teacherId]} />
            </Field>
          )}
        />
      ) : null}
    </FormSection>
  );
}
