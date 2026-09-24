import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent } from 'storybook/test';
import type { AvatarKeyDto } from '@tutorio/validation';
import { AvatarPicker } from '@/components/shared/avatar-picker';
import { TimezoneCombobox } from '@/components/shared/timezone-combobox';
import { WeekdayPicker } from '@/components/shared/weekday-picker';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { NarrowStoryContainer } from './story-helpers';

function ValueControlsContract() {
  const [avatar, setAvatar] = useState<AvatarKeyDto | null>(null);
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [weekdays, setWeekdays] = useState([1, 3, 5]);

  return (
    <div className="max-w-2xl">
      <FieldGroup>
        <Field>
          <FieldLabel>Avatar</FieldLabel>
          <AvatarPicker
            value={avatar}
            onChange={setAvatar}
            fullName="Anna Shevchenko"
            initialsLabel="Use initials"
            label="Avatar"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-timezone">Timezone</FieldLabel>
          <TimezoneCombobox
            id="reference-timezone"
            value={timezone}
            onChange={setTimezone}
            placeholder="Select timezone"
            searchPlaceholder="Search timezones"
            emptyLabel="No timezone found"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-weekdays">Weekdays</FieldLabel>
          <WeekdayPicker id="reference-weekdays" value={weekdays} onChange={setWeekdays} />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-weekday-pills">Weekdays (Studio pills)</FieldLabel>
          <WeekdayPicker
            id="reference-weekday-pills"
            appearance="pills"
            value={weekdays}
            onChange={setWeekdays}
          />
        </Field>
      </FieldGroup>
    </div>
  );
}

const meta = {
  title: 'Shared/Value controls',
  component: ValueControlsContract,
} satisfies Meta<typeof ValueControlsContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const friday = canvas.getAllByRole('button', { pressed: true }).at(-1)!;
    await userEvent.click(friday);
    await expect(friday).toHaveAttribute('aria-pressed', 'false');
  },
};

export const NarrowMobile: Story = {
  render: () => (
    <NarrowStoryContainer>
      <ValueControlsContract />
    </NarrowStoryContainer>
  ),
};
