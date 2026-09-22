import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChevronDownIcon, PhoneIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { IconButton } from '@/components/shared/icon-button';
import { PersonItem } from '@/components/shared/person-item';

type Args = {
  name: string;
  subtitle: string;
  tone: 'surface' | 'soft' | 'ink';
  size: 'md' | 'sm';
  avatarTint: 'paper' | 'warning' | 'indigo';
  withAvatarImage: boolean;
  action: boolean;
  trail: boolean;
};

function PersonItemStory({
  name,
  subtitle,
  tone,
  size,
  avatarTint,
  withAvatarImage,
  action,
  trail,
}: Args) {
  const ground = tone === 'ink' ? 'bg-ink' : 'bg-card';
  return (
    <div className={`w-90 rounded-block p-4 ${ground}`}>
      <PersonItem
        tone={tone}
        size={size}
        media={
          <EntityAvatar
            fullName={name}
            avatarKey={withAvatarImage ? 'user-2' : null}
            tint={avatarTint}
            size={size === 'sm' ? 'sm' : 'md'}
          />
        }
        name={name}
        subtitle={subtitle}
        action={
          action ? (
            <IconButton size={38} tone="paper" icon={<PhoneIcon />} label={`Call ${name}`} />
          ) : undefined
        }
        trail={trail ? <ChevronDownIcon className="size-4" /> : undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Base/PersonItem',
  component: PersonItemStory,
  args: {
    name: 'Iryna Shevchenko',
    subtitle: 'Mother · pays for lessons',
    tone: 'surface',
    size: 'md',
    avatarTint: 'warning',
    withAvatarImage: false,
    action: true,
    trail: false,
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['surface', 'soft', 'ink'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    avatarTint: { control: 'inline-radio', options: ['paper', 'warning', 'indigo'] },
  },
} satisfies Meta<typeof PersonItemStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const TeacherOnInk: Story = {
  args: {
    name: 'Dmytro Tutor',
    subtitle: 'Room 2 · uses 1 credit',
    tone: 'ink',
    size: 'sm',
    withAvatarImage: true,
    action: false,
  },
};
