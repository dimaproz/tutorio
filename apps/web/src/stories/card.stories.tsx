import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type Args = {
  tone: 'surface' | 'info' | 'warning' | 'indigo' | 'ink' | 'feature' | 'danger';
  size: 'default' | 'sm';
  radius: 'card' | 'hero';
};

/**
 * The Card primitive with Tutorio's painted tones and radii. It is a surface
 * only: product cards (notes, linked people, the profile hero…) are their own
 * components under Shared/Cards.
 */
function CardStory({ tone, size, radius }: Args) {
  return (
    <Card tone={tone} size={size} radius={radius} className="w-96 max-w-full">
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>Supporting text in the muted pair of the tone.</CardDescription>
      </CardHeader>
      <CardContent>Body copy sits on the same surface.</CardContent>
    </Card>
  );
}

const meta = {
  title: 'Foundation/Card',
  component: CardStory,
  args: { tone: 'surface', size: 'default', radius: 'card' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['surface', 'info', 'warning', 'indigo', 'ink', 'feature', 'danger'],
    },
    size: { control: 'inline-radio', options: ['default', 'sm'] },
    radius: { control: 'inline-radio', options: ['card', 'hero'] },
  },
} satisfies Meta<typeof CardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
