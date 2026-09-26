import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { SoloRefusalDialog } from './solo-refusal-dialog';

type Args = { others: number };

/**
 * Why a studio cannot switch to tutor mode (`SOLO_MODE_SINGLE_TEACHER`). The
 * teachers pages no longer offer the switch while colleagues teach (the
 * owner's answer, 2026-09-26), so this is the fallback for a refusal the API
 * still returns — a colleague added in another tab — and the dialog the
 * settings step (S10) reuses. `others` is how many other teachers are active.
 */
function SoloRefusalStory({ others }: Args) {
  return <SoloRefusalDialog open onOpenChange={() => undefined} others={others} />;
}

const meta = {
  title: 'Teachers/Patterns/SoloRefusalDialog',
  component: SoloRefusalStory,
  args: { others: 3 },
  argTypes: { others: { control: { type: 'number', min: 1, max: 20 } } },
} satisfies Meta<typeof SoloRefusalStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async () => {
    const dialog = within(await within(document.body).findByRole('dialog'));
    await expect(await dialog.findByText("Can't switch to tutor mode")).toBeVisible();
    await expect(dialog.getByText('The studio has 3 more active teachers')).toBeVisible();
  },
};
