import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from '@/components/ui/badge';

const TONES = [
  'success',
  'warning',
  'danger',
  'info',
  'indigo',
  'neutral',
  'brand',
  'surface',
  'on-ink',
  'on-tint',
  'success-inverse',
] as const;

type Args = {
  label: string;
  tone: (typeof TONES)[number];
  size: 'sm' | 'md' | 'lg';
  dot: boolean;
};

/** The design's `Chip`: the shadcn Badge with the Studio tones. */
function ChipStory({ label, tone, size, dot }: Args) {
  const ground =
    tone === 'on-ink'
      ? 'bg-feature'
      : tone === 'on-tint' || tone === 'success-inverse' || tone === 'surface'
        ? 'bg-tint-indigo'
        : 'bg-card';
  return (
    <div className={`w-fit rounded-block p-5 ${ground}`}>
      <Badge variant={tone} size={size} dot={dot}>
        {label}
      </Badge>
    </div>
  );
}

const meta = {
  title: 'Shared/Base/Chip',
  component: ChipStory,
  args: { label: 'Paid', tone: 'success', size: 'md', dot: false },
  argTypes: {
    tone: { control: 'select', options: TONES },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof ChipStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Today: Story = { args: { label: 'Today', tone: 'brand', dot: true } };
