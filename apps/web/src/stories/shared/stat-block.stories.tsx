import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
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
const TREND = [28, 30, 29, 32, 31, 33, 35, 34, 36, 37, 38, 39];
const SKILLS = [
  { label: 'Reading', value: 'B2', percent: 82 },
  { label: 'Listening', value: 'B2−', percent: 70 },
  { label: 'Writing', value: 'B1+', percent: 58 },
  { label: 'Speaking', value: 'B1+', percent: 52 },
];

type Args = {
  type: 'amount' | 'date' | 'chart' | 'custom';
  chart: 'bars' | 'ring' | 'segments';
  tone: 'surface' | 'tint' | 'accent' | 'ink';
  label: string;
  value: string;
  unit: string;
  sub: string;
  aside: string;
  asideLabel: string;
  percent: number;
  badge: string;
  badgeTone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  caption: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
};

/**
 * The universal 184px metric card. One shape — header, value zone, footer —
 * with four value types and four painted tones. Switch `type` and `chart` to
 * move between every variant the design uses.
 */
function StatBlockStory(args: Args) {
  const common = {
    label: args.label,
    tone: args.tone,
    caption: args.caption || undefined,
    detail: args.detail || undefined,
    badge: args.badge ? { label: args.badge, tone: args.badgeTone } : undefined,
    action: args.actionLabel ? { label: args.actionLabel, onClick: args.onAction } : undefined,
  };

  const block =
    args.type === 'amount' ? (
      <StatBlock
        {...common}
        type="amount"
        value={args.value}
        unit={args.unit || undefined}
        aside={args.aside || undefined}
        asideLabel={args.asideLabel || undefined}
      />
    ) : args.type === 'date' ? (
      <StatBlock {...common} type="date" value={args.value} sub={args.sub || undefined} />
    ) : args.type === 'custom' ? (
      <StatBlock {...common} type="custom" items={SKILLS} />
    ) : args.chart === 'ring' ? (
      <StatBlock {...common} type="chart" chart="ring" value={args.value} percent={args.percent} />
    ) : args.chart === 'segments' ? (
      <StatBlock {...common} type="chart" chart="segments" value={args.value} data={ATTENDANCE} />
    ) : (
      <StatBlock {...common} type="chart" chart="bars" value={args.value} data={TREND} />
    );

  return <div className="w-72">{block}</div>;
}

const meta = {
  title: 'Shared/Cards/StatBlock',
  component: StatBlockStory,
  args: {
    type: 'amount',
    chart: 'bars',
    tone: 'surface',
    label: 'Paid this term',
    value: '4 000',
    unit: '₴',
    sub: '',
    aside: '',
    asideLabel: '',
    percent: 75,
    badge: 'Nothing due',
    badgeTone: 'success',
    caption: 'Last payment 1 Sep',
    detail: '+4 000 ₴',
    actionLabel: '',
    onAction: fn(),
  },
  argTypes: {
    type: { control: 'inline-radio', options: ['amount', 'date', 'chart', 'custom'] },
    chart: {
      control: 'inline-radio',
      options: ['bars', 'ring', 'segments'],
      if: { arg: 'type', eq: 'chart' },
    },
    tone: { control: 'inline-radio', options: ['surface', 'tint', 'accent', 'ink'] },
    badgeTone: {
      control: 'inline-radio',
      options: ['success', 'warning', 'danger', 'info', 'neutral'],
    },
    percent: { control: { type: 'range', min: 0, max: 100 }, if: { arg: 'chart', eq: 'ring' } },
    unit: { if: { arg: 'type', eq: 'amount' } },
    aside: { if: { arg: 'type', eq: 'amount' }, description: 'Secondary figure, e.g. "500 ₴".' },
    asideLabel: { if: { arg: 'type', eq: 'amount' } },
    sub: { if: { arg: 'type', eq: 'date' } },
    actionLabel: { description: 'Replaces the footer detail with an xs action button.' },
  },
} satisfies Meta<typeof StatBlockStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithAside: Story = {
  args: {
    badge: '',
    caption: 'Last payment 1 Sep',
    detail: '',
    aside: '500 ₴',
    asideLabel: 'per lesson',
  },
};

export const WithAction: Story = {
  args: {
    label: 'Low on credits',
    value: '5',
    unit: 'students',
    badge: '≤ 2 left',
    badgeTone: 'warning',
    caption: '',
    detail: '',
    actionLabel: 'Offer a top-up',
  },
};
