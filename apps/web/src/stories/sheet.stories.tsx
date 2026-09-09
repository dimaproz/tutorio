import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NarrowStoryContainer } from './story-helpers';

function SheetContract({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Open filters</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Student filters</SheetTitle>
          <SheetDescription>Choose the students shown in this collection.</SheetDescription>
        </SheetHeader>
        <div className="px-4 text-sm text-muted-foreground">No filters selected.</div>
        <SheetFooter>
          <Button>Apply filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const meta = {
  title: 'Foundation/Sheet',
  component: SheetContract,
} satisfies Meta<typeof SheetContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = {
  args: { defaultOpen: true },
};

export const NarrowMobile: Story = {
  render: () => <NarrowStoryContainer><SheetContract /></NarrowStoryContainer>,
};

export const OpensAndCloses: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open filters' }));
    await waitFor(() => expect(within(document.body).getByRole('dialog')).toBeVisible());
    await userEvent.click(within(document.body).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).not.toBeVisible());
  },
};
