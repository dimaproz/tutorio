import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

function SelectContract({ disabled = false, invalid = false }: { disabled?: boolean; invalid?: boolean }) {
  const [value, setValue] = useState('individual');

  return (
    <FieldGroup className="max-w-md">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="lesson-format">Lesson format</FieldLabel>
        <Select value={value} onValueChange={setValue} disabled={disabled}>
          <SelectTrigger id="lesson-format" aria-invalid={invalid || undefined}>
          <SelectValue placeholder="Choose a lesson format" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Lesson format</SelectLabel>
              <SelectItem value="individual">Individual lessons</SelectItem>
              <SelectItem value="group">Group lessons</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {invalid ? <FieldError>Select a lesson format.</FieldError> : null}
      </Field>
    </FieldGroup>
  );
}

const meta = {
  title: 'Foundation/Select',
  component: SelectContract,
} satisfies Meta<typeof SelectContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};

export const ValidationError: Story = {
  args: { invalid: true },
};

export const KeyboardSelection: Story = {
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('combobox', { name: 'Lesson format' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(trigger).toHaveTextContent('Group lessons');
    await expect(within(document.body).queryByRole('listbox')).not.toBeInTheDocument();
  },
};
