import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { GraduationCapIcon } from 'lucide-react';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';

const TEACHERS: EntityPickerOption[] = [
  { value: 'olena', label: 'Olena Kovalenko', avatarKey: 'user-1', description: 'English' },
  { value: 'taras', label: 'Taras Melnyk', avatarKey: 'user-2', description: 'Maths' },
  { value: 'iryna', label: 'Iryna Bondar', avatarKey: null, description: 'German' },
];

type Args = {
  appearance: 'button' | 'field';
  selected: boolean;
  disabled: boolean;
  invalid: boolean;
  loading: boolean;
  noOptions: boolean;
  onChange: (value?: string) => void;
};

/**
 * The searchable single-choice picker with avatars: the teacher in the group
 * form (`field`) and the collection filters (`button`).
 */
function EntityPickerStory({
  appearance,
  selected,
  disabled,
  invalid,
  loading,
  noOptions,
  onChange,
}: Args) {
  const [value, setValue] = useState<string | undefined>(selected ? 'olena' : undefined);

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
    appearance: 'field',
    selected: false,
    disabled: false,
    invalid: false,
    loading: false,
    noOptions: false,
    onChange: fn(),
  },
  argTypes: {
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
