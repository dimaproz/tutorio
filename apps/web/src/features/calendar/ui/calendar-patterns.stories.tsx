import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import {
  CALENDAR_CLOCK,
  calendarStoryMonth,
  calendarStoryWeek,
} from '@/stories/calendar-story-backend';
import { calendarPeriod } from '../model/period';
import { CalendarAgenda, CalendarDaySide, CalendarWeekStrip } from './calendar-day-parts';
import {
  CalendarEvent,
  type CalendarEventState,
  type CalendarEventVariant,
} from './calendar-event';
import { CalendarLegend } from './calendar-legend';
import { CalendarMonthDots, CalendarMonthGrid } from './calendar-month-grid';
import { CalendarTimeGrid } from './calendar-time-grid';

const WEEK = calendarStoryWeek(true);
const MONTH = calendarStoryMonth();
const ANCHOR = new Date(CALENDAR_CLOCK);
const WEEK_DAYS = calendarPeriod('week', ANCHOR).days;
const MONTH_DAYS = calendarPeriod('month', ANCHOR).days;

/** Which of the boards' lessons the event story shows. */
const SAMPLES = {
  upcoming: WEEK.find(
    (item) => item.student?.fullName === 'Sofiia Melnyk' && item.status === 'SCHEDULED',
  )!,
  held: WEEK.find((item) => item.student?.fullName === 'Artem Lysenko')!,
  unpaid: WEEK.find((item) => item.charges.some((charge) => !charge.paid))!,
  running: WEEK.find((item) => item.topic === 'Speaking: travel')!,
  makeup: WEEK.find((item) => item.kind === 'MAKEUP')!,
  cancelled: WEEK.find((item) => item.status === 'CANCELLED_UNCHARGED')!,
  noShow: WEEK.find((item) => item.status === 'NO_SHOW')!,
  long: WEEK.find((item) => item.durationMin === 180)!,
  short: WEEK.find((item) => item.durationMin === 45 && item.student)!,
};

type EventArgs = {
  sample: keyof typeof SAMPLES;
  variant: CalendarEventVariant;
  state: CalendarEventState;
  showTeacher: boolean;
  onClick: () => void;
};

/**
 * `CalendarEvent` (S03 decisions 4–6): the colour says the kind, the fill
 * the time, the marks what happened. `block` sits on the week grid (compact
 * at 45 minutes, the topic from 90), `wide` on the day view, `chip` in a
 * month cell, `row` in the phone's lists; `ghost`, `dragging` and `conflict`
 * are the drag states.
 */
function EventStory({ sample, variant, state, showTeacher, onClick }: EventArgs) {
  const lesson = SAMPLES[sample];
  const height = variant === 'block' ? (lesson.durationMin / 60) * 44 - 3 : undefined;
  return (
    <div className={variant === 'wide' || variant === 'row' ? 'w-150' : 'w-48'} style={{ height }}>
      <CalendarEvent
        lesson={lesson}
        nowMs={CALENDAR_CLOCK}
        variant={variant}
        compact={variant === 'block' && lesson.durationMin <= 45}
        withTopic={lesson.durationMin >= 90}
        showTeacher={showTeacher}
        state={state}
        meta={variant === 'row' ? `${lesson.durationMin} min · individual` : undefined}
        onClick={onClick}
      />
    </div>
  );
}

const meta = {
  title: 'Calendar/Patterns/CalendarEvent',
  component: EventStory,
  args: { sample: 'running', variant: 'block', state: 'idle', showTeacher: false, onClick: fn() },
  argTypes: {
    sample: { control: 'select', options: Object.keys(SAMPLES) },
    variant: { control: 'inline-radio', options: ['block', 'wide', 'chip', 'row'] },
    state: { control: 'inline-radio', options: ['idle', 'ghost', 'dragging', 'conflict'] },
  },
} satisfies Meta<typeof EventStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: /B2 prep · evening, group, running now/ }),
    ).toBeVisible();
  },
};

export const Cancelled: Story = { args: { sample: 'cancelled' } };
export const Makeup: Story = { args: { sample: 'makeup', variant: 'wide' } };
export const Compact: Story = { args: { sample: 'short' } };
export const Dragging: Story = { args: { sample: 'upcoming', state: 'conflict' } };

/** `CalendarTimeGrid`: the week with lanes, today's tint and the now line. */
export const TimeGrid: StoryObj = {
  render: () => (
    <div className="w-full max-w-360">
      <CalendarTimeGrid
        days={WEEK_DAYS}
        lessons={WEEK}
        nowMs={CALENDAR_CLOCK}
        showTeacher
        onOpenLesson={fn()}
        onMoveLesson={fn()}
        onPickSlot={fn()}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('region', { name: 'Lessons by time' }),
    ).toBeVisible();
  },
};

/** `CalendarMonthGrid`: three chips a day, then «+N more». */
export const MonthGrid: StoryObj = {
  render: () => (
    <div className="w-full max-w-360">
      <CalendarMonthGrid
        days={MONTH_DAYS}
        anchor={ANCHOR}
        lessons={MONTH}
        nowMs={CALENDAR_CLOCK}
        onOpenLesson={fn()}
        onShowDay={fn()}
      />
    </div>
  ),
};

/** The phone's month dots and week strip. */
export const PhoneParts: StoryObj = {
  render: () => (
    <div className="flex w-97 flex-col gap-4">
      <CalendarWeekStrip days={WEEK_DAYS} lessons={WEEK} selected={ANCHOR} onSelect={fn()} />
      <CalendarMonthDots
        days={MONTH_DAYS}
        anchor={ANCHOR}
        lessons={MONTH}
        selected={ANCHOR}
        onSelect={fn()}
      />
    </div>
  ),
};

/** The desktop day's side panel. */
export const DaySide: StoryObj = {
  render: () => (
    <div className="w-85">
      <CalendarDaySide
        days={WEEK_DAYS}
        day={ANCHOR}
        lessons={WEEK.filter((item) => item.teacher.name === 'Dmytro Tutor')}
        nowMs={CALENDAR_CLOCK}
        onSelectDay={fn()}
      />
    </div>
  ),
};

/** The phone's week agenda. */
export const Agenda: StoryObj = {
  render: () => (
    <div className="w-97">
      <CalendarAgenda
        days={WEEK_DAYS.slice(0, 3)}
        lessons={WEEK}
        nowMs={CALENDAR_CLOCK}
        onOpenLesson={fn()}
      />
    </div>
  ),
};

/** The legend under the grid. */
export const Legend: StoryObj = {
  render: () => <CalendarLegend />,
};
