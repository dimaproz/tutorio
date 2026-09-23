import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  AttendanceList,
  type AttendanceCellState,
  type AttendanceListRow,
} from '@/components/shared/attendance-list';
import { EmptyState } from '@/components/shared/empty-state';

type Scenario = 'risk' | 'allGood' | 'hold' | 'cancelledWindow' | 'short';

const P: AttendanceCellState = 'present';
const A: AttendanceCellState = 'absent';
const C: AttendanceCellState = 'cancelled';
const U: AttendanceCellState = 'unmarked';

function row(
  id: string,
  name: string,
  cells: AttendanceCellState[],
  rate: string,
  note: string,
  tone: AttendanceListRow['tone'] = 'plain',
): AttendanceListRow {
  const [first, last] = name.split(' ');
  return {
    id,
    name,
    shortName: `${first} ${last?.[0] ?? ''}.`,
    avatarKey: `user-${(id.charCodeAt(0) % 10) + 1}`,
    cells,
    rate,
    note,
    cellsLabel: `${cells.filter((cell) => cell === 'present').length} present of ${cells.length}`,
    tone,
  };
}

const SCENARIOS: Record<Scenario, { rows: AttendanceListRow[]; rate: string; misses: number }> = {
  risk: {
    rate: '88%',
    misses: 4,
    rows: [
      row('artem', 'Artem Lysenko', [C, P, P, P, P, C, A, A], '67%', '2 absences in a row · last came 16.09', 'risk'),
      row('kate', 'Kateryna Shevchuk', [C, P, P, P, P, C, U, U], '—', 'On a break since 18.09 · not counted', 'hold'),
      row('anna', 'Anna Shevchenko', [C, P, P, P, P, C, P, A], '83%', '1 absence · 25.09'),
      row('mark', 'Mark Shevchenko', [C, P, P, P, P, C, P, P], '100%', 'no absences'),
    ],
  },
  allGood: {
    rate: '100%',
    misses: 0,
    rows: [
      row('anna', 'Anna Shevchenko', [P, P, P, P, P, P, P, P], '100%', 'no absences'),
      row('mark', 'Mark Shevchenko', [P, P, P, P, P, P, P, P], '100%', 'no absences'),
    ],
  },
  hold: {
    rate: '92%',
    misses: 1,
    rows: [
      row('kate', 'Kateryna Shevchuk', [P, P, P, P, U, U, U, U], '—', 'On a break · not counted', 'hold'),
      row('anna', 'Anna Shevchenko', [P, P, A, P, P, P, P, P], '88%', '1 absence · 25.09'),
    ],
  },
  cancelledWindow: {
    rate: '—',
    misses: 0,
    rows: [row('anna', 'Anna Shevchenko', [C, C, C], '—', 'no lessons held')],
  },
  short: {
    rate: '100%',
    misses: 0,
    rows: [
      row('anna', 'Anna Shevchenko', [P, P], '100%', 'no absences'),
      row('mark', 'Mark Shevchenko', [P, U], '100%', 'no absences'),
    ],
  },
};

type Args = { scenario: Scenario; compact: boolean; empty: boolean };

/**
 * Attendance over the last held lessons. `scenario` covers the design's
 * cases — someone at risk, everyone fine, someone on hold, a window of only
 * cancelled lessons and fewer lessons than the window — and `compact` is the
 * phone layout with two tiles and "all students".
 */
function AttendanceListStory({ scenario, compact, empty }: Args) {
  const data = SCENARIOS[scenario];
  const [all, setAll] = useState(false);
  return (
    <div className={compact ? 'w-90 max-w-full' : 'w-170 max-w-full'}>
      <AttendanceList
        title="Attendance"
        windowLabel="last 8 lessons"
        compact={compact}
        stats={{
          lessons: { label: 'Lessons', value: 8, note: '6 taught' },
          rate: { label: 'Attendance', value: data.rate, note: 'group average', good: scenario === 'allGood' },
          misses: { label: 'Absences', value: data.misses, note: 'of 34 visits', warn: data.misses > 0 },
          cancelled: {
            label: 'Cancelled',
            value: 2,
            charged: { value: 1, label: 'charged' },
            free: { value: 1, label: 'free' },
          },
        }}
        rows={data.rows}
        visibleRows={compact && !all ? 3 : undefined}
        onShowAll={() => setAll(true)}
        showAllLabel={`All ${data.rows.length} students`}
        empty={
          empty ? (
            <EmptyState
              framed={false}
              minHeight={160}
              title="No attendance yet"
              text="It appears after the first lesson is marked."
            />
          ) : undefined
        }
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Lists/AttendanceList',
  component: AttendanceListStory,
  args: { scenario: 'risk', compact: false, empty: false },
  argTypes: {
    scenario: {
      control: 'inline-radio',
      options: ['risk', 'allGood', 'hold', 'cancelledWindow', 'short'],
    },
  },
} satisfies Meta<typeof AttendanceListStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Phones show the first rows, then reveal the rest on demand. */
export const PhoneShowsAll: Story = {
  args: { compact: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    await expect(canvas.getByText('Artem L.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'All 4 students' }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
  },
};
