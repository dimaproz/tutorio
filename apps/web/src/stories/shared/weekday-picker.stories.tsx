import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { WeekdayPicker } from '@/components/shared/weekday-picker';

type Args = {
  appearance: 'compact' | 'cards' | 'pills';
  fill: boolean;
  disabled: boolean;
  invalid: boolean;
  onChange: (weekdays: number[]) => void;
};

/**
 * The weekdays a recurring schedule repeats on (the group form uses `pills`;
 * the lesson form's weekly block `pills` with `fill`, one full-width row).
 * Weekday names follow the toolbar locale.
 */
function WeekdayPickerStory({ appearance, fill, disabled, invalid, onChange }: Args) {
  const [value, setValue] = useState([1, 4]);

  return (
    <div className="w-full max-w-3xl rounded-card bg-card p-6">
      <span id="weekday-picker-label" className="mb-3 block text-sm font-semibold">
        Days
      </span>
      <WeekdayPicker
        aria-labelledby="weekday-picker-label"
        appearance={appearance}
        fill={fill}
        disabled={disabled}
        invalid={invalid}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/WeekdayPicker',
  component: WeekdayPickerStory,
  args: { appearance: 'pills', fill: false, disabled: false, invalid: false, onChange: fn() },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['compact', 'cards', 'pills'] },
    onChange: { table: { disable: true } },
  },
} satisfies Meta<typeof WeekdayPickerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ args, canvas }) => {
    // Monday and Thursday start pressed; pressing Wednesday adds it.
    await userEvent.click(canvas.getAllByRole('button')[2]);
    await expect(args.onChange).toHaveBeenCalled();
  },
};
