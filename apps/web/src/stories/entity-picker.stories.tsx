import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import ukMessages from '../../messages/uk.json';
import { EntityMultiSelect, EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

const options: EntityPickerOption[] = [
  { value: 'anna', label: 'Anna Shevchenko', description: 'Parent' },
  { value: 'oleh', label: 'Oleh Kovalenko', description: 'Parent' },
  { value: 'maria', label: 'Maria Bondarenko', description: 'Teacher' },
];

function EntityPickerContract({ disabled = false, invalid = false, isLoading = false, longCopy = false }: { disabled?: boolean; invalid?: boolean; isLoading?: boolean; longCopy?: boolean }) {
  const [value, setValue] = useState<string | undefined>();

  return (
    <FieldGroup className="max-w-md">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="parent-picker">Parent</FieldLabel>
        <EntityPicker
          id="parent-picker"
          aria-label="Parent"
          value={value}
          options={options}
          onChange={setValue}
          placeholder={longCopy ? ukMessages.students.form.addParentPlaceholder : 'Link an existing parent'}
          searchPlaceholder={longCopy ? ukMessages.students.form.addParentSearch : 'Search parents'}
          emptyLabel={longCopy ? ukMessages.students.form.addParentEmpty : 'No parent found'}
          clearLabel="Clear selection"
          disabled={disabled}
          invalid={invalid}
          isLoading={isLoading}
        />
        {invalid ? <FieldError>Select a parent or leave the field empty.</FieldError> : null}
      </Field>
    </FieldGroup>
  );
}

function EntityMultiSelectContract() {
  const [selectedIds, setSelectedIds] = useState(['anna']);

  return (
    <EntityMultiSelect
      options={options}
      selectedIds={selectedIds}
      onChange={setSelectedIds}
      placeholder="Link another parent"
      searchPlaceholder="Search parents"
      emptyLabel="No parent found"
      removeLabel={(name) => `Remove ${name}`}
      pickerAriaLabel="Link another parent"
    />
  );
}

const meta = {
  title: 'Shared/EntityPicker',
  component: EntityPickerContract,
} satisfies Meta<typeof EntityPickerContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Loading: Story = {
  args: { isLoading: true },
};

export const ValidationError: Story = {
  args: { invalid: true },
};

export const LongUkrainianCopy: Story = {
  args: { longCopy: true },
  globals: { locale: 'uk' },
};

export const KeyboardSelectChangeAndClear: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Parent' });
    await userEvent.click(trigger);
    await userEvent.keyboard('Maria{ArrowDown}{Enter}');
    await expect(canvas.getByRole('combobox', { name: 'Parent' })).toHaveTextContent('Maria Bondarenko');
    const selectedTrigger = canvas.getByRole('combobox', { name: 'Parent' });
    await waitFor(() => expect(selectedTrigger).toHaveAttribute('aria-expanded', 'false'));
    await userEvent.click(selectedTrigger);
    await waitFor(() => expect(selectedTrigger).toHaveAttribute('aria-expanded', 'true'));
    await userEvent.clear(await within(document.body).findByPlaceholderText('Search parents'));
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Clear selection' }));
    await expect(canvas.getByRole('combobox', { name: 'Parent' })).toHaveTextContent('Link an existing parent');
  },
};

export const MultipleSelectionCanBeChanged: Story = {
  render: () => <EntityMultiSelectContract />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'Link another parent' }));
    await userEvent.click(within(document.body).getByText('Oleh Kovalenko'));
    await expect(canvas.getByRole('button', { name: 'Remove Oleh Kovalenko' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Anna Shevchenko' }));
    await expect(canvas.queryByRole('button', { name: 'Remove Anna Shevchenko' })).not.toBeInTheDocument();
  },
};
