import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ArrowRightIcon,
  BoxIcon,
  CalendarIcon,
  HeartIcon,
  LayersIcon,
  PencilIcon,
} from 'lucide-react';
import { expect, fn, userEvent } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { SetupChecklist } from '@/components/shared/setup-checklist';

const ITEMS = [
  {
    id: 'lesson',
    icon: <CalendarIcon />,
    title: 'Schedule the first lesson',
    description: 'Create a one-off lesson for this student.',
    action: 'Schedule',
  },
  {
    id: 'package',
    icon: <BoxIcon />,
    title: 'Add a package',
    description: 'Set up the lesson balance and payment.',
    action: 'Add package',
  },
  {
    id: 'learning',
    icon: <LayersIcon />,
    title: 'Set up learning',
    description: 'Add individual or group learning.',
    action: 'Set up',
  },
  {
    id: 'parent',
    icon: <HeartIcon />,
    title: 'Link or create a parent',
    description: 'Add a contact to the saved profile.',
    action: 'Add contact',
  },
  {
    id: 'profile',
    icon: <PencilIcon />,
    title: 'Complete the profile',
    description: 'Add levels, avatar, preferences and notes.',
    action: 'Edit profile',
  },
];

type Args = {
  title: string;
  text: string;
  items: number;
  dismissible: boolean;
  onDismiss: () => void;
};

function SetupChecklistStory({ title, text, items, dismissible, onDismiss }: Args) {
  return (
    <div className="w-185 max-w-full">
      <SetupChecklist
        title={title}
        text={text || undefined}
        dismissLabel="Dismiss setup suggestions"
        onDismiss={dismissible ? onDismiss : undefined}
        items={ITEMS.slice(0, items).map((item) => ({
          ...item,
          action: (
            <Button type="button" variant="outline" size="xs">
              {item.action}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ),
        }))}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/SetupChecklist',
  component: SetupChecklistStory,
  args: {
    title: 'Student created — choose the next step',
    text: 'These steps are independent. Dismiss the card and come back to setup any time.',
    items: 5,
    dismissible: true,
    onDismiss: fn(),
  },
  argTypes: { items: { control: { type: 'range', min: 1, max: 5 } } },
} satisfies Meta<typeof SetupChecklistStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss setup suggestions' }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
};
