import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { TimezoneCombobox } from '@/components/shared/timezone-combobox';

type Args = { value: string; invalid: boolean; disabled: boolean };

/**
 * The design's `OptionList`, as the searchable timezone combobox: a field box
 * trigger and an option list with offsets and a check on the selected zone.
 */
function OptionListStory({ value: initial, invalid, disabled }: Args) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex w-100 max-w-full flex-col gap-2">
      <label htmlFor="story-timezone" className="text-sm font-medium">
        Timezone
      </label>
      <TimezoneCombobox
        id="story-timezone"
        value={value}
        onChange={setValue}
        placeholder="Choose a timezone"
        searchPlaceholder="Search zones…"
        emptyLabel="No zone found"
        invalid={invalid}
        disabled={disabled}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/OptionList',
  component: OptionListStory,
  args: { value: 'Europe/Kyiv', invalid: false, disabled: false },
  argTypes: { value: { control: 'select', options: ['', 'Europe/Kyiv', 'Europe/Warsaw', 'UTC'] } },
} satisfies Meta<typeof OptionListStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    const body = within(document.body);
    await userEvent.type(await body.findByPlaceholderText('Search zones…'), 'warsaw');
    await userEvent.click(await body.findByRole('option', { name: /Europe\/Warsaw/ }));
    await expect(canvas.getByRole('combobox')).toHaveTextContent('Europe/Warsaw');
  },
};
