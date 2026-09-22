import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProgressMeter } from '@/components/shared/progress-meter';

type Args = { value: number; total: number; caption: string };

function ProgressMeterStory({ value, total, caption }: Args) {
  return (
    <div className="w-70">
      <ProgressMeter
        value={value}
        total={total}
        label={`${value} of ${total} filled`}
        caption={caption || undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/ProgressMeter',
  component: ProgressMeterStory,
  args: { value: 4, total: 6, caption: 'ready to create' },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 10 } },
    total: { control: { type: 'range', min: 1, max: 10 } },
  },
} satisfies Meta<typeof ProgressMeterStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
