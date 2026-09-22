import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ArchiveIcon, EllipsisIcon, PauseIcon, PencilIcon } from 'lucide-react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/shared/icon-button';

type Args = { withDanger: boolean; withDivider: boolean; open: boolean };

/** The design's `ActionMenu`: the shadcn DropdownMenu in its Studio styling. */
function ActionMenuStory({ withDanger, withDivider, open }: Args) {
  return (
    <DropdownMenu defaultOpen={open} modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton icon={<EllipsisIcon />} label="More actions" border />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-65">
        <DropdownMenuItem>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem>
          <PauseIcon />
          Pause
        </DropdownMenuItem>
        {withDivider ? <DropdownMenuSeparator /> : null}
        {withDanger ? (
          <DropdownMenuItem variant="destructive">
            <ArchiveIcon />
            Archive
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const meta = {
  title: 'Shared/Menus/ActionMenu',
  component: ActionMenuStory,
  args: { withDanger: true, withDivider: true, open: false },
} satisfies Meta<typeof ActionMenuStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }));
    const menu = await within(document.body).findByRole('menu');
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: 'Archive' })).toBeVisible(),
    );
  },
};
