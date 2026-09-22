import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { ArchiveIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  StatusMenuContent,
  StatusSheet,
  type StatusOption,
} from '@/components/shared/status-options';
import { StatusTrigger } from '@/components/shared/status-trigger';

type Status = 'active' | 'hold' | 'archived';

const OPTIONS: StatusOption<Status>[] = [
  {
    value: 'active',
    label: 'Active',
    description: 'Lessons are scheduled and charged to the package.',
    icon: <PlayIcon />,
    tone: 'active',
  },
  {
    value: 'hold',
    label: 'On a break',
    description: 'Paused: no new lessons are planned. The package and history are kept.',
    icon: <PauseIcon />,
    tone: 'hold',
  },
  {
    value: 'archived',
    label: 'Archived',
    description: 'Hidden from the list, view only. Can be restored any time.',
    icon: <ArchiveIcon />,
    tone: 'archived',
  },
];

type Args = {
  status: Status;
  size: 'sm' | 'md' | 'lg';
  presentation: 'menu' | 'sheet';
  prefix: string;
  note: string;
  onSelect: (status: Status) => void;
};

/**
 * StatusSelect, StatusMenu and StatusSheet together: the pill opens the
 * dropdown on desktop or the bottom sheet on phones. Pick `presentation` to
 * switch between them.
 */
function StatusSelectStory({ status, size, presentation, prefix, note, onSelect }: Args) {
  const [value, setValue] = useState(status);
  const [sheetOpen, setSheetOpen] = useState(false);
  const option = OPTIONS.find((item) => item.value === value) ?? OPTIONS[0];
  const select = (next: Status) => {
    setValue(next);
    onSelect(next);
  };
  const trigger = (props: { onClick?: () => void; 'aria-expanded'?: boolean }) => (
    <StatusTrigger
      tone={option.tone}
      label={option.label}
      size={size}
      prefix={prefix || undefined}
      aria-label={`Student status: ${option.label}. Change`}
      {...props}
    />
  );
  const ground = size === 'sm' ? 'bg-tint-indigo' : 'bg-background';

  return (
    <div className={`w-fit rounded-block p-6 ${ground}`}>
      {presentation === 'sheet' ? (
        <>
          {trigger({ onClick: () => setSheetOpen(true), 'aria-expanded': sheetOpen })}
          <StatusSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="Student status"
            closeLabel="Close"
            value={value}
            options={OPTIONS}
            note={note || undefined}
            onSelect={(next) => {
              setSheetOpen(false);
              select(next);
            }}
          />
        </>
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>{trigger({})}</DropdownMenuTrigger>
          <StatusMenuContent
            heading="Student status"
            label="Change student status"
            value={value}
            options={OPTIONS}
            note={note || undefined}
            onSelect={select}
          />
        </DropdownMenu>
      )}
    </div>
  );
}

const meta = {
  title: 'Shared/Status/StatusSelect',
  component: StatusSelectStory,
  args: {
    status: 'active',
    size: 'sm',
    presentation: 'menu',
    prefix: '',
    note: '',
    onSelect: fn(),
  },
  argTypes: {
    status: { control: 'inline-radio', options: ['active', 'hold', 'archived'] },
    size: {
      control: 'inline-radio',
      options: ['sm', 'md', 'lg'],
      description: 'sm 26 · md 34 · lg 40',
    },
    presentation: {
      control: 'inline-radio',
      options: ['menu', 'sheet'],
      description: '`menu` is StatusMenu (desktop), `sheet` is StatusSheet (phones).',
    },
    note: { description: 'Context under the options, e.g. on the edit page.' },
  },
} satisfies Meta<typeof StatusSelectStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    const trigger = canvas.getByRole('button', { name: /Student status: Active/ });
    await userEvent.click(trigger);
    const menu = within(await within(document.body).findByRole('menu'));
    await expect(menu.getByRole('menuitemradio', { name: /Active/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(menu.getByRole('menuitemradio', { name: /On a break/ }));
    await expect(args.onSelect).toHaveBeenCalledWith('hold');
  },
};

export const EditPageNote: Story = {
  args: {
    size: 'md',
    note: 'The status changes immediately, apart from saving the form — your edits stay.',
  },
};

export const Sheet: Story = {
  args: { presentation: 'sheet', status: 'hold' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Student status/ }));
    const sheet = within(await within(document.body).findByRole('dialog'));
    await expect(sheet.getByRole('radio', { name: /On a break/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};
