import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DurationField } from '@/components/shared/duration-field';
import { FieldFrame } from '@/components/shared/text-field';
import { useDurationHint, useDurationLabels } from '@/features/lessons/ui/field-labels';

const STATES = {
  filled: '60',
  custom: '75',
  empty: '',
  outOfRange: '0',
} as const;

type Args = {
  state: keyof typeof STATES;
  usual: boolean;
  onChange: (value: string) => void;
};

/**
 * A lesson length in minutes (board FieldsTime): a typed number with the
 * unit and a list of popular lengths, the usual one marked «як зазвичай»; a
 * length outside the list becomes its first row. The hint gives the hours
 * and the end of the first lesson. On a phone (toolbar viewport) the list
 * becomes quick chips under the field.
 */
function DurationFieldStory({ state, usual, onChange }: Args) {
  const t = useTranslations('lessons.fields');
  const tValidation = useTranslations('validation');
  const labels = useDurationLabels();
  const hint = useDurationHint();
  const [value, setValue] = useState<string>(STATES[state]);
  const minutes = Number(value);
  const error =
    value.trim() === ''
      ? tValidation('lessonDurationRequired')
      : minutes < 5 || minutes > 480
        ? tValidation('lessonDurationRange')
        : undefined;
  return (
    <div className="w-80 max-w-full">
      <FieldFrame
        label={t('duration')}
        error={state === 'filled' || state === 'custom' ? undefined : error}
        hint={hint(minutes, '17:00')}
      >
        {(a11y) => (
          <DurationField
            id={a11y.id}
            aria-describedby={a11y.describedBy}
            invalid={Boolean(a11y.invalid)}
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
            labels={labels}
            usual={usual ? 60 : null}
          />
        )}
      </FieldFrame>
    </div>
  );
}

const meta = {
  title: 'Shared/Form/DurationField',
  component: DurationFieldStory,
  args: { state: 'filled', usual: true, onChange: fn() },
  argTypes: {
    state: { control: 'select', options: Object.keys(STATES) },
    onChange: { table: { disable: true } },
  },
} satisfies Meta<typeof DurationFieldStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The list offers the popular lengths; picking one replaces the value. */
export const PicksPopular: Story = {
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: 'Length' }));
    await userEvent.keyboard('{ArrowDown}');
    const list = within(document.body);
    await userEvent.click(await list.findByRole('option', { name: /90 min/ }));
    await expect(args.onChange).toHaveBeenLastCalledWith('90');
    await expect(canvas.getByText('1 h 30 min · until 18:30')).toBeVisible();
  },
};
