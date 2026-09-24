import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MoveChange } from '@/components/shared/move-change';

type Args = {
  stacked: boolean;
  fromTime: string;
  toTime: string;
  fromHint: string;
  toHint: string;
};

/** The old and the new time of a moved lesson; `stacked` is the phone sheet. */
function MoveChangeStory({ stacked, fromTime, toTime, fromHint, toHint }: Args) {
  return (
    <div className="w-110 max-w-full">
      <MoveChange
        stacked={stacked}
        from={{ date: { top: 'пт', day: '11' }, label: 'Було', time: fromTime, hint: fromHint }}
        to={{ date: { top: 'пт', day: '11' }, label: 'Стане', time: toTime, hint: toHint }}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/MoveChange',
  component: MoveChangeStory,
  args: {
    stacked: false,
    fromTime: '17:00',
    toTime: '18:30',
    fromHint: 'щоп’ятниці',
    toHint: 'з 11 вересня',
  },
} satisfies Meta<typeof MoveChangeStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
