import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { toast } from 'sonner';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

type Args = { text: string };

/** The success toast: the installed sonner host, styled as the ink pill. */
function ToastStory({ text }: Args) {
  return (
    <>
      <Button type="button" variant="outline" onClick={() => toast.success(text)}>
        Show toast
      </Button>
      <Toaster />
    </>
  );
}

const meta = {
  title: 'Shared/Feedback/Toast',
  component: ToastStory,
  args: { text: 'Student created' },
} satisfies Meta<typeof ToastStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show toast' }));
    const toastText = await within(document.body).findByText(args.text);
    await waitFor(() => expect(toastText).toBeVisible());
  },
};
