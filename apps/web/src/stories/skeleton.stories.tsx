import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton } from '@/components/ui/skeleton';

function SkeletonContract() {
  return (
    <div className="flex max-w-md flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

const meta = {
  title: 'Foundation/Skeleton',
  component: SkeletonContract,
} satisfies Meta<typeof SkeletonContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
