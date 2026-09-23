import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { StoryBackend } from '@/stories/story-backend';
import { StudentQuickCreateDialog } from './student-quick-create-dialog';

type Args = { navigateOnSuccess: boolean };

/**
 * StudentQuickCreateDialog: the compact create path used from the collection
 * and from a group. Only the name is required; "Add more details" reveals the
 * optional fields.
 */
function StudentQuickCreateStory({ navigateOnSuccess }: Args) {
  return (
    <StoryBackend>
      <StudentQuickCreateDialog
        open
        onOpenChange={() => undefined}
        navigateOnSuccess={navigateOnSuccess}
      />
    </StoryBackend>
  );
}

const meta = {
  title: 'Students/Components/StudentQuickCreateDialog',
  component: StudentQuickCreateStory,
  args: { navigateOnSuccess: true },
} satisfies Meta<typeof StudentQuickCreateStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** An error in the collapsed section reopens it, so the failure is never silent. */
export const HiddenFieldError: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByRole('textbox', { name: 'Full name' }), 'Sofiia Melnyk');
    await userEvent.click(body.getByRole('button', { name: 'Add more details' }));
    await userEvent.type(await body.findByRole('textbox', { name: 'Email' }), 'not-an-email');
    await userEvent.click(body.getByRole('button', { name: 'Add more details' }));
    await expect(body.queryByRole('textbox', { name: 'Email' })).toBeNull();
    await userEvent.click(body.getByRole('button', { name: 'Create student' }));
    const email = await body.findByRole('textbox', { name: 'Email' });
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription(/.+/);
  },
};
