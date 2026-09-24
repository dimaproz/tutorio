import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { FieldFrame } from '@/components/shared/text-field';
import { TimeField } from '@/components/shared/time-field';
import { useFormDates, useTimeLabels } from '@/features/lessons/ui/field-labels';

const STATES = {
  empty: { value: '' },
  filled: { value: '17:00' },
  busy: { value: '17:00' },
  error: { value: '25:00' },
  locked: { value: '17:00' },
} as const;

type Args = {
  state: keyof typeof STATES;
  compact: boolean;
  onChange: (value: string) => void;
};

/**
 * The start time of the lesson forms (board FieldsTime): a combobox that
 * takes any typed time ("1740" → 17:40) and suggests 15-minute steps; a
 * slot another lesson takes is marked and stays selectable. On a phone
 * (toolbar viewport) a tap opens the sheet with a grid of 30-minute steps.
 * `compact` is the phone date row's narrow box.
 */
function TimeFieldStory({ state, compact, onChange }: Args) {
  const t = useTranslations('lessons.fields');
  const tValidation = useTranslations('validation');
  const labels = useTimeLabels();
  const dates = useFormDates();
  const [value, setValue] = useState<string>(STATES[state].value);
  return (
    <div className={compact ? 'w-23' : 'w-60'}>
      <FieldFrame
        label={t('time')}
        error={state === 'error' ? tValidation('lessonTimeInvalid') : undefined}
        hint={state === 'locked' ? t('timeLocked') : undefined}
      >
        {(a11y) => (
          <TimeField
            id={a11y.id}
            aria-describedby={a11y.describedBy}
            invalid={Boolean(a11y.invalid)}
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
            labels={{
              ...labels,
              sheetTitle: t('timeSheetTitle', { date: dates.long('2026-10-01') }),
            }}
            busy={state === 'busy' ? { '18:00': 'B2 prep', '18:30': 'B2 prep' } : {}}
            locked={state === 'locked'}
            compact={compact}
          />
        )}
      </FieldFrame>
    </div>
  );
}

const meta = {
  title: 'Shared/Form/TimeField',
  component: TimeFieldStory,
  args: { state: 'filled', compact: false, onChange: fn() },
  argTypes: {
    state: { control: 'select', options: Object.keys(STATES) },
    onChange: { table: { disable: true } },
  },
} satisfies Meta<typeof TimeFieldStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A typed "1740" becomes 17:40, offered first as a custom time; Enter confirms it. */
export const TypesAnyTime: Story = {
  args: { state: 'busy' },
  play: async ({ args, canvas }) => {
    const input = canvas.getByRole('combobox', { name: 'Start' });
    await userEvent.clear(input);
    await userEvent.type(input, '1740');
    const list = within(document.body);
    await waitFor(() => expect(list.getByRole('option', { name: /17:40.*custom/ })).toBeVisible());
    await userEvent.keyboard('{Enter}');
    await expect(args.onChange).toHaveBeenLastCalledWith('17:40');
    await expect(input).toHaveValue('17:40');
  },
};

/** A busy slot shows the lesson that takes it, and can still be picked. */
export const BusySlot: Story = {
  args: { state: 'busy' },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'Start' }));
    const list = within(document.body);
    await userEvent.click(await list.findByRole('option', { name: /18:00.*B2 prep/ }));
    await expect(args.onChange).toHaveBeenLastCalledWith('18:00');
  },
};
