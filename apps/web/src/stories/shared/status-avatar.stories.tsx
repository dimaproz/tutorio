import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AVATAR_KEYS } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';

type Args = {
  fullName: string;
  avatarKey: (typeof AVATAR_KEYS)[number] | 'initials';
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status: 'none' | 'active' | 'hold' | 'archived';
  tint: 'paper' | 'warning' | 'indigo' | 'surface';
  ring: 'none' | 'halo' | 'hero';
};

/** The design's `StatusAvatar`: an illustration or initials, with a lifecycle dot. */
function StatusAvatarStory({ fullName, avatarKey, size, status, tint, ring }: Args) {
  return (
    <div className="w-fit rounded-block bg-tint-indigo p-6">
      <EntityAvatar
        fullName={fullName}
        avatarKey={avatarKey === 'initials' ? null : avatarKey}
        size={size}
        tint={tint}
        status={status === 'none' ? undefined : status}
        statusLabel={status === 'none' ? undefined : status}
        ring={ring === 'none' ? false : ring === 'hero' ? 'hero' : true}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Base/StatusAvatar',
  component: StatusAvatarStory,
  args: {
    fullName: 'Anna Shevchenko',
    avatarKey: 'user-1',
    size: 'md',
    status: 'active',
    tint: 'paper',
    ring: 'none',
  },
  argTypes: {
    avatarKey: { control: 'select', options: ['initials', ...AVATAR_KEYS] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
    status: { control: 'inline-radio', options: ['none', 'active', 'hold', 'archived'] },
    tint: { control: 'inline-radio', options: ['paper', 'warning', 'indigo', 'surface'] },
    ring: { control: 'inline-radio', options: ['none', 'halo', 'hero'] },
  },
} satisfies Meta<typeof StatusAvatarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Initials: Story = { args: { avatarKey: 'initials', tint: 'indigo', status: 'hold' } };
