import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatBlock, type StatBlockSegment } from '@/components/shared/stat-block';

const ATTENDANCE: StatBlockSegment[] = [
  'ok',
  'ok',
  'ok',
  'ok',
  'ok',
  'ok',
  'ok',
  'miss',
  'ok',
  'ok',
  'ok',
  'ok',
];

const WEEKLY_LESSONS = [34, 37, 36, 39, 38, 41, 43, 42, 44, 46, 47, 48];

const SKILLS = [
  { label: 'Reading', value: 'B2', percent: 82 },
  { label: 'Listening', value: 'B2−', percent: 70 },
  { label: 'Writing', value: 'B1+', percent: 58 },
  { label: 'Speaking', value: 'B1+', percent: 52 },
];

const meta = {
  title: 'Shared/StatBlock',
  component: StatBlock,
} satisfies Meta<typeof StatBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Amount: Story = {
  args: {
    type: 'amount',
    label: 'Paid this term',
    value: '4 000',
    unit: '₴',
    badge: { label: 'Nothing due', tone: 'success' },
    caption: 'Last payment 1 Sep',
    detail: '+4 000 ₴',
  },
};

export const AmountOnInk: Story = {
  args: {
    type: 'amount',
    tone: 'ink',
    label: 'Awaiting payment',
    value: '12 400',
    unit: '₴',
    badge: { label: '4 packages', tone: 'warning' },
    caption: 'Oldest is 9 days overdue',
  },
};

export const DateValue: Story = {
  args: {
    type: 'date',
    label: 'Next lesson',
    value: 'Thu, 11 Sep',
    sub: '17:00 – 18:00',
    badge: { label: 'in 2 days', tone: 'info' },
    caption: 'Speaking · Dmytro Tutor',
  },
};

export const DateOnTint: Story = {
  args: {
    type: 'date',
    tone: 'tint',
    label: 'Package expires',
    value: '30 Nov',
    sub: '2026',
    caption: 'B2 preparation',
    detail: '69 days',
  },
};

export const ChartBars: Story = {
  args: {
    type: 'chart',
    chart: 'bars',
    tone: 'accent',
    label: 'Lessons this week',
    value: '64',
    data: WEEKLY_LESSONS,
    badge: { label: '+8%', tone: 'neutral' },
    caption: '52 individual · 12 group',
  },
};

export const ChartRing: Story = {
  args: {
    type: 'chart',
    chart: 'ring',
    label: 'Credits left',
    value: '6 of 8',
    percent: 75,
    caption: 'B2 preparation package',
    detail: '2 used',
  },
};

export const ChartSegments: Story = {
  args: {
    type: 'chart',
    chart: 'segments',
    label: 'Attendance',
    value: '92%',
    data: ATTENDANCE,
    caption: '11 attended · 1 late cancel',
  },
};

export const CustomRows: Story = {
  args: {
    type: 'custom',
    label: 'Towards B2 exam',
    items: SKILLS,
    badge: { label: 'Dec 2026', tone: 'neutral' },
    caption: 'Teacher assessment',
    detail: '9 Sep',
  },
};

/** A footer command replaces the mono detail and takes the tone's button fill. */
export const WithFooterAction: Story = {
  args: {
    type: 'amount',
    label: 'Low on credits',
    value: '5',
    unit: 'students',
    badge: { label: '≤ 2 left', tone: 'warning' },
    caption: '10% of all',
    action: { label: 'Offer top-up' },
  },
};

/** An over-long label truncates rather than pushing the badge out of the block. */
export const LongLabel: Story = {
  args: {
    type: 'amount',
    label: 'Outstanding balance across every active lesson package this term',
    value: '12 400',
    unit: '₴',
    badge: { label: '4 packages', tone: 'warning' },
    caption: 'Oldest is 9 days overdue',
  },
};

export const Ukrainian: Story = {
  globals: { locale: 'uk' },
  args: {
    type: 'chart',
    chart: 'ring',
    tone: 'tint',
    label: 'Залишок занять',
    value: '6 з 8',
    percent: 75,
    caption: 'Пакет підготовки до B2',
    detail: '2 використано',
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
  args: {
    type: 'amount',
    label: 'Paid this term',
    value: '4 000',
    unit: '₴',
    badge: { label: 'Nothing due', tone: 'success' },
    caption: 'Last payment 1 Sep',
    detail: '+4 000 ₴',
  },
};

/** Recreates `reference/stat-block.png` for the fidelity comparison. */
export const Gallery: Story = {
  args: { type: 'amount', label: 'Paid this term', value: '4 000' },
  render: () => (
    <div className="grid grid-cols-4 gap-4">
      <StatBlock
        type="amount"
        label="Paid this term"
        value="4 000"
        unit="₴"
        badge={{ label: 'Nothing due', tone: 'success' }}
        caption="Last payment 1 Sep"
        detail="+4 000 ₴"
      />
      <StatBlock
        type="amount"
        tone="ink"
        label="Awaiting payment"
        value="12 400"
        unit="₴"
        badge={{ label: '4 packages', tone: 'warning' }}
        caption="Oldest is 9 days overdue"
      />
      <StatBlock
        type="date"
        label="Next lesson"
        value="Thu, 11 Sep"
        sub="17:00 – 18:00"
        badge={{ label: 'in 2 days', tone: 'info' }}
        caption="Speaking · Dmytro Tutor"
      />
      <StatBlock
        type="date"
        tone="tint"
        label="Package expires"
        value="30 Nov"
        sub="2026"
        caption="B2 preparation"
        detail="69 days"
      />
      <StatBlock
        type="chart"
        chart="bars"
        tone="accent"
        label="Lessons this week"
        value="64"
        data={WEEKLY_LESSONS}
        badge={{ label: '+8%', tone: 'neutral' }}
        caption="52 individual · 12 group"
      />
      <StatBlock
        type="chart"
        chart="ring"
        label="Credits left"
        value="6 of 8"
        percent={75}
        caption="B2 preparation package"
        detail="2 used"
      />
      <StatBlock
        type="chart"
        chart="segments"
        label="Attendance"
        value="92%"
        data={ATTENDANCE}
        caption="11 attended · 1 late cancel"
      />
      <StatBlock
        type="custom"
        label="Towards B2 exam"
        items={SKILLS}
        badge={{ label: 'Dec 2026', tone: 'neutral' }}
        caption="Teacher assessment"
        detail="9 Sep"
      />
    </div>
  ),
};
