import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from '@/components/ui/badge';

const meta = {
  title: 'Foundation/Badge',
  component: Badge,
  args: {
    children: 'Active',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Archived',
  },
};

export const SemanticStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="primary">Active</Badge>
      <Badge variant="success">Paid</Badge>
      <Badge variant="warning">On hold</Badge>
      <Badge variant="destructive">Archived</Badge>
    </div>
  ),
};

/** Every tint the Studio theme ships, each with its own foreground pair. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success">Paid</Badge>
      <Badge variant="warning">Partly paid</Badge>
      <Badge variant="danger">Due 2 400 ₴</Badge>
      <Badge variant="info">Scheduled</Badge>
      <Badge variant="indigo">Individual</Badge>
      <Badge variant="neutral">Settled</Badge>
      <Badge variant="brand">Today</Badge>
      <Badge variant="surface">Active</Badge>
    </div>
  ),
};

/** The tones that only read correctly on a painted surface. */
export const OnPaintedSurfaces: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <span className="inline-flex rounded-hero bg-ink p-4">
        <Badge variant="on-ink">in 2 days</Badge>
      </span>
      <span className="inline-flex rounded-hero bg-tint-indigo p-4">
        <Badge variant="on-tint">Student since Aug 2026</Badge>
      </span>
    </div>
  ),
};

export const WithDot: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="surface" dot>
        Active
      </Badge>
      <Badge variant="brand" dot>
        Today
      </Badge>
      <Badge variant="danger" dot>
        Due
      </Badge>
      <Badge variant="neutral" dot>
        Archived
      </Badge>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success" size="sm">
        Small
      </Badge>
      <Badge variant="success" size="md">
        Medium
      </Badge>
      <Badge variant="success" size="lg">
        Large
      </Badge>
    </div>
  ),
};

/** Navigation and filter counts: mono figures, active state on a sky fill. */
export const Counters: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="counter">12</Badge>
      <Badge variant="counter">48</Badge>
      <Badge variant="counter" className="bg-brand-soft text-brand-soft-foreground">
        48
      </Badge>
    </div>
  ),
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
