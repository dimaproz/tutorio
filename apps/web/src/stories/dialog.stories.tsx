import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function DialogContract({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button>Archive student</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive this student?</DialogTitle>
          <DialogDescription>
            The student will leave operational lists while history remains intact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive">Archive student</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NestedPortalControlsContract() {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit enrollment</DialogTitle>
          <DialogDescription>
            Floating controls stay operable inside the active modal layer.
          </DialogDescription>
        </DialogHeader>
        <Select defaultValue="individual">
          <SelectTrigger aria-label="Lesson format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Individual lessons</SelectItem>
            <SelectItem value="group">Group lessons</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Show schedule note</Button>
          </PopoverTrigger>
          <PopoverContent>Schedule changes are applied in the workspace timezone.</PopoverContent>
        </Popover>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Archive enrollment</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this enrollment?</AlertDialogTitle>
              <AlertDialogDescription>Lesson history will remain available.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive">Archive</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

const meta = {
  title: 'Foundation/Dialog',
  component: DialogContract,
} satisfies Meta<typeof DialogContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = {
  args: { defaultOpen: true },
};

export const OpensAndClosesWithKeyboard: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Archive student' }));
    await waitFor(() => expect(within(document.body).getByRole('dialog')).toBeVisible());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).not.toBeVisible());
  },
};

export const NestedPortalControls: Story = {
  render: () => <NestedPortalControlsContract />,
  play: async () => {
    const page = within(document.body);

    await userEvent.click(page.getByRole('combobox', { name: 'Lesson format' }));
    await userEvent.click(page.getByRole('option', { name: 'Group lessons' }));
    await expect(page.getByRole('combobox', { name: 'Lesson format' })).toHaveTextContent(
      'Group lessons',
    );

    await userEvent.click(page.getByRole('button', { name: 'Show schedule note' }));
    await waitFor(() => expect(page.getByText(/workspace timezone/i)).toBeVisible());
    await userEvent.keyboard('{Escape}');

    await userEvent.click(page.getByRole('button', { name: 'Archive enrollment' }));
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(page.queryByRole('alertdialog')).not.toBeInTheDocument());
  },
};
