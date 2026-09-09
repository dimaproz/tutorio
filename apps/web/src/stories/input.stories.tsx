import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import ukMessages from '../../messages/uk.json';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

function InputContract({ invalid = false, ...props }: React.ComponentProps<typeof Input> & { invalid?: boolean }) {
  return (
    <FieldGroup className="max-w-md">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="student-name">Student name</FieldLabel>
        <Input id="student-name" aria-invalid={invalid || undefined} {...props} />
        {invalid ? <FieldError>Enter at least two characters.</FieldError> : null}
      </Field>
    </FieldGroup>
  );
}

const meta = {
  title: 'Foundation/Input',
  component: InputContract,
  args: {
    placeholder: 'Anna Shevchenko',
  },
} satisfies Meta<typeof InputContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'Anna Shevchenko',
    readOnly: true,
  },
};

export const ValidationError: Story = {
  args: {
    invalid: true,
    value: 'A',
    readOnly: true,
  },
};

export const LongUkrainianCopy: Story = {
  args: {
    placeholder: ukMessages.students.form.notesPlaceholder,
  },
  globals: {
    locale: 'uk',
  },
};

export const KeyboardEntry: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Student name' });
    await userEvent.click(input);
    await userEvent.keyboard('Anna');
    await expect(input).toHaveValue('Anna');
  },
};
