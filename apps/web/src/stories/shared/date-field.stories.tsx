import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { enUS, uk } from 'date-fns/locale';
import { expect, userEvent, within } from 'storybook/test';
import { useFormatter, useLocale } from 'next-intl';
import { DateField } from '@/components/shared/date-field';

type Args = { value: string; disabled: boolean; invalid: boolean };

/**
 * A calendar date in the form field box: the trigger shows the date in the
 * locale's short form, the popover picks another. The value is "yyyy-MM-dd".
 */
function DateFieldStory({ value: initial, disabled, invalid }: Args) {
  const [value, setValue] = useState(initial);
  const format = useFormatter();
  const locale = useLocale();
  return (
    <div className="w-90 max-w-full">
      <DateField
        value={value}
        onValueChange={setValue}
        disabled={disabled}
        invalid={invalid}
        placeholder="Pick a date"
        locale={locale === 'uk' ? uk : enUS}
        formatValue={(date) =>
          format.dateTime(date, {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        }
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/DateField',
  component: DateFieldStory,
  args: { value: '2026-09-11', disabled: false, invalid: false },
} satisfies Meta<typeof DateFieldStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Picking a day in the calendar replaces the value and closes it. */
export const PicksADay: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button'));
    await userEvent.click(await body.findByRole('button', { name: /15/ }));
    await expect(canvas.getByRole('button')).toHaveTextContent('15');
  },
};
