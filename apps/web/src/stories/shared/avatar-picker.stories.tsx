import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { AVATAR_KEYS, type AvatarKeyDto } from '@tutorio/validation';
import { expect, userEvent } from 'storybook/test';
import { AvatarPicker } from '@/components/shared/avatar-picker';

type Args = {
  fullName: string;
  selected: AvatarKeyDto | 'initials';
  layout: 'row' | 'stack';
  disabled: boolean;
};

function AvatarPickerStory({ fullName, selected, layout, disabled }: Args) {
  const [value, setValue] = useState<AvatarKeyDto | null>(
    selected === 'initials' ? null : selected,
  );
  return (
    <div
      className={
        layout === 'stack' ? 'w-80 rounded-block bg-card p-5' : 'w-170 rounded-block bg-card p-5'
      }
    >
      <AvatarPicker
        value={value}
        onChange={setValue}
        fullName={fullName}
        initialsLabel="Initials"
        label="Avatar"
        layout={layout}
        disabled={disabled}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/AvatarPicker',
  component: AvatarPickerStory,
  args: { fullName: 'Sofiia Melnyk', selected: 'initials', layout: 'row', disabled: false },
  argTypes: {
    selected: { control: 'select', options: ['initials', ...AVATAR_KEYS] },
    layout: { control: 'inline-radio', options: ['row', 'stack'] },
  },
} satisfies Meta<typeof AvatarPickerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    const initials = canvas.getByRole('radio', { name: 'Initials' });
    await expect(initials).toHaveAttribute('aria-checked', 'true');
    initials.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Avatar 1' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};
