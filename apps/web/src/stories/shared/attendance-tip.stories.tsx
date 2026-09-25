import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AttendanceTip, type AttendanceTipTone } from '@/components/shared/attendance-tip';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';

type Args = {
  title: string;
  tone: AttendanceTipTone;
  line: string;
  second: string;
  note: string;
};

const CELL: Record<AttendanceTipTone, string> = {
  present: 'bg-success',
  absent: 'bg-danger-mark',
  excused: 'bg-hold-mark',
  muted: 'bg-stat-track',
};

/**
 * One attendance cell with its tooltip (S08 decision 7): the lesson's date
 * and topic, a coloured dot per line and a quiet context line. It opens on
 * hover and focus, and on a tap on phones; the open cell gets a ring. Used by
 * `AttendanceList` (a member's cells) and `StatBlock` (the metric's cells).
 */
function AttendanceTipStory({ title, tone, line, second, note }: Args) {
  return (
    <div className="flex items-center gap-[3px] p-16">
      <AttendanceTip
        tip={{
          title,
          lines: [
            { tone, text: line },
            ...(second ? [{ tone: 'absent' as const, text: second }] : []),
          ],
          note: note || undefined,
        }}
        className={cn('h-4.5 w-2.5 rounded-[3px]', CELL[tone])}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Feedback/AttendanceTip',
  // The app provides the tooltip timing; a story on its own does it here.
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  component: AttendanceTipStory,
  args: {
    title: 'Thu, 3 Sep · Vocabulary: travel',
    tone: 'absent',
    line: 'Artem missed',
    second: '',
    note: 'Miss 1 of 2 in a row',
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['present', 'absent', 'excused', 'muted'] },
    second: { description: 'A second line, e.g. who missed the lesson in the metric.' },
  },
} satisfies Meta<typeof AttendanceTipStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The metric's cell: how many came and who missed. */
export const Lesson: Story = {
  args: {
    title: 'Tue, 18 Aug · Speaking practice',
    tone: 'present',
    line: 'Came 5 of 6',
    second: 'Missed: Anna Shevchenko',
    note: '',
  },
};

/** A tap opens it too (phones), and it names the cell for assistive technology. */
export const OpensOnTap: Story = {
  play: async ({ canvasElement }) => {
    const cell = within(canvasElement).getByRole('button', {
      name: 'Thu, 3 Sep · Vocabulary: travel. Artem missed. Miss 1 of 2 in a row',
    });
    await userEvent.click(cell);
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      'Artem missed',
    );
  },
};
