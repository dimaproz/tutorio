import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';
import type { GlyphName } from '@/components/shared/glyph';
import { TextField } from '@/components/shared/text-field';
import { glyphControl, glyphNode } from '../story-helpers';

type Args = {
  type: 'text' | 'email' | 'password' | 'time' | 'select' | 'textarea';
  label: string;
  placeholder: string;
  value: string;
  icon: GlyphName | 'none';
  prefix: string;
  suffix: string;
  hint: string;
  error: string;
  aside: string;
  required: boolean;
  disabled: boolean;
  rows: number;
};

const LEVELS = [
  { value: 'none', label: 'Not set' },
  { value: 'A1', label: 'A1 — beginner' },
  { value: 'B2', label: 'B2 — upper intermediate' },
  { value: 'C1', label: 'C1 — advanced' },
];

/**
 * Label, control and hint or error as one unit, for every field type the
 * product uses. Focus the box to see the indigo ring; set `error` to see the
 * danger state wired to the control with `aria-invalid` and `aria-describedby`.
 */
function TextFieldStory(args: Args) {
  const [value, setValue] = useState(args.value);
  const chrome = {
    label: args.label,
    hint: args.hint || undefined,
    error: args.error || undefined,
    aside: args.aside || undefined,
    required: args.required,
    icon: glyphNode(args.icon),
  };

  return (
    <div className="w-100 max-w-full rounded-block bg-card p-6">
      {args.type === 'select' ? (
        <TextField
          {...chrome}
          type="select"
          placeholder={args.placeholder}
          value={value || undefined}
          onValueChange={setValue}
          disabled={args.disabled}
          options={LEVELS}
        />
      ) : args.type === 'textarea' ? (
        <TextField
          {...chrome}
          type="textarea"
          rows={args.rows}
          placeholder={args.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={args.disabled}
        />
      ) : (
        <TextField
          {...chrome}
          type={args.type}
          prefix={args.prefix || undefined}
          suffix={args.suffix || undefined}
          placeholder={args.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={args.disabled}
          revealLabels={{ show: 'Show password', hide: 'Hide password' }}
        />
      )}
    </div>
  );
}

const meta = {
  title: 'Shared/Form/TextField',
  component: TextFieldStory,
  args: {
    type: 'email',
    label: 'Email',
    placeholder: 'you@example.com',
    value: '',
    icon: 'mail',
    prefix: '',
    suffix: '',
    hint: '',
    error: '',
    aside: '',
    required: false,
    disabled: false,
    rows: 3,
  },
  argTypes: {
    type: {
      control: 'inline-radio',
      options: ['text', 'email', 'password', 'time', 'select', 'textarea'],
    },
    icon: glyphControl,
    prefix: { description: 'Leading unit in its own cell, e.g. `@`.' },
    suffix: { description: 'Trailing unit inside the box, e.g. `min`.' },
    aside: { description: 'Mono note beside the label, e.g. a counter.' },
    rows: { control: { type: 'range', min: 2, max: 8 }, if: { arg: 'type', eq: 'textarea' } },
  },
} satisfies Meta<typeof TextFieldStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithError: Story = {
  args: {
    type: 'text',
    label: 'Full name',
    icon: 'none',
    required: true,
    error: 'Enter the student’s name',
  },
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: /Full name/ });
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Enter the student’s name');
  },
};

export const Password: Story = {
  args: { type: 'password', label: 'Password', icon: 'lock', value: 'correct-horse-battery' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show password' }));
    await expect(canvas.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

export const Telegram: Story = {
  args: { type: 'text', label: 'Telegram username', icon: 'none', prefix: '@', value: 'sofi_m' },
};

export const Notes: Story = {
  args: {
    type: 'textarea',
    label: 'Notes',
    icon: 'none',
    rows: 4,
    placeholder: 'What is worth remembering about this student?',
    aside: '0 / 4000',
  },
};
