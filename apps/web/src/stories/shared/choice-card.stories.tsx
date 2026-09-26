import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Building2Icon, UserIcon } from 'lucide-react';
import { expect, userEvent } from 'storybook/test';
import { ChoiceCardGroup, type ChoiceCardAppearance } from '@/components/shared/choice-card';

type Args = {
  selected: 'SOLO' | 'SCHOOL';
  disabled: boolean;
  /** `tile`: the settings choice (S10), indigo with a ring and a check disc. */
  appearance: ChoiceCardAppearance;
  /** `tile` only: the empty circle on the tiles not chosen. */
  idleIndicator: boolean;
};

function ChoiceCardStory({ selected, disabled, appearance, idleIndicator }: Args) {
  const [value, setValue] = useState(selected);
  return (
    <div className="w-130 max-w-full rounded-block bg-card p-6">
      <ChoiceCardGroup
        label="How do you work?"
        value={value}
        onValueChange={setValue}
        disabled={disabled}
        appearance={appearance}
        idleIndicator={idleIndicator}
        options={[
          {
            value: 'SOLO',
            title: 'I tutor on my own',
            hint: 'No teacher pickers anywhere — every lesson is yours. Changeable later in settings.',
            icon: <UserIcon />,
          },
          {
            value: 'SCHOOL',
            title: 'We are a school with several teachers',
            hint: 'Lessons and enrollments record which teacher they belong to.',
            icon: <Building2Icon />,
          },
        ]}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/ChoiceCard',
  component: ChoiceCardStory,
  args: { selected: 'SCHOOL', disabled: false, appearance: 'card', idleIndicator: true },
  argTypes: {
    selected: { control: 'inline-radio', options: ['SOLO', 'SCHOOL'] },
    appearance: { control: 'inline-radio', options: ['card', 'tile'] },
  },
} satisfies Meta<typeof ChoiceCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    const solo = canvas.getByRole('radio', { name: /I tutor on my own/ });
    await userEvent.click(canvas.getByText('I tutor on my own'));
    await expect(solo).toHaveAttribute('aria-checked', 'true');
  },
};

/** The settings tile (S10): chosen by a click anywhere, the check follows. */
export const Tile: Story = {
  args: { appearance: 'tile' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText('I tutor on my own'));
    await expect(canvas.getByRole('radio', { name: /I tutor on my own/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  },
};
