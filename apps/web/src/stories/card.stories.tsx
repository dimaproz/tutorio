import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MoreHorizontalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function CardContract({ size = 'default' }: { size?: 'default' | 'sm' }) {
  return (
    <Card size={size} className="max-w-md">
      <CardHeader>
        <CardTitle>Anna Shevchenko</CardTitle>
        <CardDescription>Individual English lessons</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="Student actions">
            <MoreHorizontalIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>Next lesson: Thursday at 16:00</CardContent>
      <CardFooter className="justify-between">
        <span>Active</span>
        <Button size="sm">Open profile</Button>
      </CardFooter>
    </Card>
  );
}

const meta = {
  title: 'Foundation/Card',
  component: CardContract,
} satisfies Meta<typeof CardContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { size: 'sm' },
};

/** Painted card surfaces. Each tone carries its own foreground. */
export const Tones: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">Surface</Card>
      <Card tone="info" className="p-5">
        Package
      </Card>
      <Card tone="warning" className="p-5">
        Notes
      </Card>
      <Card tone="indigo" radius="hero" className="p-5">
        Profile hero
      </Card>
      <Card tone="ink" radius="hero" className="p-5">
        Next lesson ticket
      </Card>
    </div>
  ),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
