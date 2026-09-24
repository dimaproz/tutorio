import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ArrowLeftRightIcon, GraduationCapIcon, TriangleAlertIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { FieldNote } from '@/components/shared/field-note';
import { FieldFrame } from '@/components/shared/text-field';

const TEACHERS: EntityPickerOption[] = [
  { value: 'olena', label: 'Olena Kovalenko', avatarKey: 'user-1' },
  { value: 'taras', label: 'Taras Melnyk', avatarKey: 'user-2' },
  { value: 'iryna', label: 'Iryna Bondar', avatarKey: null },
];

/** The lesson form's teacher field (board FieldsTeacher). */
const TEACHER_STATES = [
  'none',
  'direction',
  'substitution',
  'busy',
  'group',
  'weekly',
  'locked',
] as const;
type TeacherState = (typeof TEACHER_STATES)[number];

type Args = {
  teacherField: TeacherState;
  appearance: 'button' | 'field';
  selected: boolean;
  disabled: boolean;
  invalid: boolean;
  loading: boolean;
  noOptions: boolean;
  onChange: (value?: string) => void;
};

/**
 * The teacher field of the lesson forms: rich rows (the direction's teacher
 * marked «основний», a busy teacher's note), the hint by context, the sky
 * strip of a substitute, the warning of a busy teacher and the locked look
 * of a held lesson. In solo mode the field is not rendered at all.
 */
function TeacherFieldStory({ state }: { state: Exclude<TeacherState, 'none'> }) {
  const t = useTranslations('lessons.fields');
  const initial = state === 'substitution' ? 'iryna' : state === 'busy' ? 'oleh' : 'dmytro';
  const [value, setValue] = useState<string>(initial);
  const options: EntityPickerOption[] = [
    {
      value: 'dmytro',
      label: 'Dmytro Tutor',
      description: t('teacherOfStudent', { name: 'Anna' }),
      badges: [
        <Badge key="main" variant="indigo" size="sm">
          {t('teacherMain')}
        </Badge>,
      ],
    },
    { value: 'iryna', label: 'Iryna Bondar', avatarKey: 'user-9' },
    {
      value: 'oleh',
      label: 'Oleh Marchenko',
      avatarKey: 'user-8',
      trail: (
        <span className="flex items-center gap-1.5 text-xs font-medium text-tint-warning-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-pill bg-warning" />
          {t('teacherBusy', { time: '17:00' })}
        </span>
      ),
    },
  ];
  const hint =
    state === 'group'
      ? t('teacherHintGroup')
      : state === 'weekly'
        ? t('teacherHintWeekly')
        : state === 'direction'
          ? t('teacherHintDirection', { name: 'Anna' })
          : undefined;
  return (
    <div className="flex w-110 max-w-full flex-col gap-2 rounded-card bg-card p-6">
      <FieldFrame label={t('teacher')} hint={hint}>
        {(a11y) => (
          <EntityPicker
            id={a11y.id}
            aria-describedby={a11y.describedBy}
            appearance="field"
            value={value}
            options={options}
            onChange={(next) => setValue(next ?? value)}
            placeholder={t('teacherPlaceholder')}
            searchPlaceholder={t('teacherSearch')}
            emptyLabel={t('teacherEmpty')}
            locked={state === 'locked'}
          />
        )}
      </FieldFrame>
      {value !== 'dmytro' && state !== 'locked' ? (
        <FieldNote
          appearance="strip"
          icon={<ArrowLeftRightIcon />}
          action={
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto px-0 font-semibold"
              onClick={() => setValue('dmytro')}
            >
              {t('substitutionRestore')}
            </Button>
          }
        >
          {t.rich('substitution', {
            name: 'Dmytro Tutor',
            b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
          })}
        </FieldNote>
      ) : null}
      {value === 'oleh' ? (
        <FieldNote tone="warning" icon={<TriangleAlertIcon />}>
          {t('teacherBusyNote', { time: '17:00', name: 'B1 English' })}
        </FieldNote>
      ) : null}
    </div>
  );
}

/**
 * The searchable single-choice picker with avatars: the teacher in the group
 * form (`field`) and the collection filters (`button`). `teacherField` shows
 * the lesson form's teacher field, with rich rows, instead.
 */
function EntityPickerStory({
  teacherField,
  appearance,
  selected,
  disabled,
  invalid,
  loading,
  noOptions,
  onChange,
}: Args) {
  const [value, setValue] = useState<string | undefined>(selected ? 'olena' : undefined);

  if (teacherField !== 'none') return <TeacherFieldStory key={teacherField} state={teacherField} />;

  return (
    <div className="w-96 max-w-full rounded-card bg-card p-6">
      <EntityPicker
        aria-label="Teacher"
        appearance={appearance}
        icon={appearance === 'field' ? <GraduationCapIcon /> : undefined}
        options={noOptions ? [] : TEACHERS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        placeholder="Choose a teacher"
        searchPlaceholder="Search teachers"
        emptyLabel="No teachers found"
        clearLabel="Clear"
        disabled={disabled}
        invalid={invalid}
        isLoading={loading}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/EntityPicker',
  component: EntityPickerStory,
  args: {
    teacherField: 'none',
    appearance: 'field',
    selected: false,
    disabled: false,
    invalid: false,
    loading: false,
    noOptions: false,
    onChange: fn(),
  },
  argTypes: {
    teacherField: { control: 'select', options: TEACHER_STATES },
    appearance: { control: 'inline-radio', options: ['button', 'field'] },
    onChange: { table: { disable: true } },
  },
} satisfies Meta<typeof EntityPickerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'Teacher' }));
    const list = within(document.body);
    await userEvent.click(await list.findByRole('option', { name: /Taras Melnyk/ }));
    await expect(args.onChange).toHaveBeenCalledWith('taras');
  },
};

/** The teacher list marks the direction's teacher and a busy one; another pick shows the strip. */
export const TeacherSubstitution: Story = {
  args: { teacherField: 'direction' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'Teacher' }));
    const list = within(document.body);
    const main = await list.findByRole('option', { name: /Dmytro Tutor.*main/ });
    await waitFor(() => expect(main).toBeVisible());
    await userEvent.click(list.getByRole('option', { name: /Iryna Bondar/ }));
    await expect(canvas.getByText(/Substitute for/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Restore' }));
    await expect(canvas.queryByText(/Substitute for/)).toBeNull();
  },
};
