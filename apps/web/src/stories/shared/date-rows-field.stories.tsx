import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { TriangleAlertIcon } from 'lucide-react';
import { expect, userEvent } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { DateRowsField, type DateRow } from '@/components/shared/date-rows-field';
import { FieldNote } from '@/components/shared/field-note';
import { useDateRowsLabels, useFormDates } from '@/features/lessons/ui/field-labels';

const ROWS: Record<string, Omit<DateRow, 'key'>[]> = {
  one: [{ date: '2026-10-01', time: '17:00' }],
  several: [
    { date: '2026-10-01', time: '17:00' },
    { date: '2026-10-05', time: '17:00' },
    { date: '2026-10-08', time: '18:30' },
  ],
  past: [{ date: '2026-09-22', time: '17:00' }],
  overlap: [{ date: '2026-10-02', time: '18:30' }],
  error: [{ date: '', time: '' }],
  edit: [{ date: '2026-10-01', time: '17:00' }],
};

type Args = { state: keyof typeof ROWS };

/**
 * The dates of the lesson form (board FieldsDates): one row per date, each
 * with its own start time; remove shows only with more than one row, and
 * «Додати дату» adds a row a week after the last one with its time. Under a
 * row: a past date, an overlap, or the error. `edit` is the single fixed
 * row. On a phone (toolbar viewport) the time column narrows.
 */
function DateRowsFieldStory({ state }: Args) {
  const t = useTranslations('lessons.fields');
  const tValidation = useTranslations('validation');
  const dates = useFormDates();
  const [rows, setRows] = useState<DateRow[]>(() =>
    ROWS[state]!.map((row, index) => ({ ...row, key: String(index) })),
  );
  const labels = useDateRowsLabels(rows.map((row) => row.date));
  const update = (index: number, patch: Partial<DateRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="w-150 max-w-full">
      <DateRowsField
        rows={rows}
        labels={labels}
        formatDate={dates.field}
        locale={dates.locale}
        fixed={state === 'edit'}
        onDateChange={(index, date) => update(index, { date })}
        onTimeChange={(index, time) => update(index, { time })}
        onRemove={(index) => setRows((current) => current.filter((_, i) => i !== index))}
        onAdd={() =>
          setRows((current) => {
            const last = current.at(-1)!;
            const next = dates.fromValue(last.date) ?? new Date(2026, 9, 1);
            next.setDate(next.getDate() + 7);
            const value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
            return [...current, { key: String(current.length), date: value, time: last.time }];
          })
        }
        busy={rows.map(() => ({ '18:00': 'B2 prep' }))}
        notes={rows.map((row) =>
          state === 'past' ? (
            <Badge key={row.key} variant="warning" dot>
              {t('pastDate')}
            </Badge>
          ) : state === 'overlap' ? (
            <FieldNote key={row.key} tone="warning" icon={<TriangleAlertIcon />}>
              {t('overlap', { name: 'B2 prep · evening', time: '18:00–19:30' })}
            </FieldNote>
          ) : null,
        )}
        errors={rows.map((row) =>
          state === 'error' && !row.date ? { date: tValidation('lessonDateRequired') } : undefined,
        )}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/DateRowsField',
  component: DateRowsFieldStory,
  args: { state: 'several' },
  argTypes: { state: { control: 'select', options: Object.keys(ROWS) } },
} satisfies Meta<typeof DateRowsFieldStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** «Додати дату» adds a row a week later with the last row's time; remove appears with it. */
export const AddsARow: Story = {
  args: { state: 'one' },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: /Remove/ })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Add a date' }));
    await expect(canvas.getAllByRole('button', { name: /Remove/ })).toHaveLength(2);
    await expect(canvas.getAllByRole('combobox', { name: 'Start' })[1]).toHaveValue('17:00');
  },
};
