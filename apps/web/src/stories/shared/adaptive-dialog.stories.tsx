import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CircleXIcon, HourglassIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { Notice } from '@/components/shared/notice';

type Args = { size: 'md' | 'lg'; withClose: boolean; longBody: boolean };

/**
 * A decision with a few fields: a dialog on desktop, a bottom sheet on phones
 * (switch the viewport in the toolbar). The body scrolls between the heading
 * and the actions; `withClose` adds the round close button on desktop.
 */
function AdaptiveDialogStory({ size, withClose, longBody }: Args) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Open
      </Button>
      <AdaptiveDialog
        open={open}
        onOpenChange={setOpen}
        size={size}
        closeLabel={withClose ? 'Close' : undefined}
        icon={<CircleXIcon />}
        iconClassName="bg-tint-danger text-tint-danger-foreground"
        title="Cancel the lesson?"
        description="Fri, 11 September · 17:00–18:00 · Anna Shevchenko"
        secondary={
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep it
          </Button>
        }
        primary={
          <Button type="button" variant="destructive" onClick={() => setOpen(false)}>
            Cancel the lesson
          </Button>
        }
      >
        {Array.from({ length: longBody ? 6 : 1 }, (_, index) => (
          <Notice
            key={index}
            appearance="callout"
            tone="warning"
            icon={<HourglassIcon />}
            title="Late cancellation"
            text="3 hours before the start — within the 24-hour deadline. We suggest charging the lesson."
          />
        ))}
      </AdaptiveDialog>
    </>
  );
}

const meta = {
  title: 'Shared/Dialogs/AdaptiveDialog',
  component: AdaptiveDialogStory,
  args: { size: 'md', withClose: true, longBody: false },
  argTypes: { size: { control: 'inline-radio', options: ['md', 'lg'] } },
} satisfies Meta<typeof AdaptiveDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The close button in the heading dismisses the dialog. */
export const CloseButton: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
  },
};
