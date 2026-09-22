import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';
import { Segmented } from '@/components/shared/segmented';
import { glyphNode } from '../story-helpers';

type Args = { variant: 'surface' | 'paper'; withCounts: boolean; iconOnly: boolean };

function SegmentedStory({ variant, withCounts, iconOnly }: Args) {
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('list');

  if (iconOnly) {
    return (
      <Segmented
        label="View"
        variant={variant}
        value={view}
        onValueChange={setView}
        items={[
          { value: 'list', icon: glyphNode('list'), ariaLabel: 'List' },
          { value: 'grid', icon: glyphNode('grid'), ariaLabel: 'Cards' },
        ]}
      />
    );
  }

  return (
    <Segmented
      label="Status"
      variant={variant}
      value={status}
      onValueChange={setStatus}
      items={[
        { value: 'all', label: 'All', count: withCounts ? 48 : undefined },
        { value: 'active', label: 'Active', count: withCounts ? 39 : undefined },
        { value: 'hold', label: 'On a break', count: withCounts ? 6 : undefined },
        { value: 'archived', label: 'Archived', count: withCounts ? 3 : undefined },
      ]}
    />
  );
}

const meta = {
  title: 'Shared/Collection/Segmented',
  component: SegmentedStory,
  args: { variant: 'surface', withCounts: true, iconOnly: false },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['surface', 'paper'],
      description: '`surface` sits on paper; `paper` sits on a card.',
    },
    iconOnly: { description: 'Icon segments select with a paper disc instead of ink.' },
  },
} satisfies Meta<typeof SegmentedStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    if (args.iconOnly) return;
    const active = canvas.getByRole('radio', { name: /Active/ });
    await userEvent.click(active);
    await expect(active).toHaveAttribute('data-state', 'on');
  },
};

export const ViewSwitch: Story = { args: { iconOnly: true } };
