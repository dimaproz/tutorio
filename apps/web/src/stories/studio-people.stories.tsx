import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChevronDownIcon, MoreVerticalIcon, PhoneIcon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { PersonItem, PersonItemTile } from '@/components/shared/person-item';

const meta = { title: 'Shared/People and credits' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const People: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <PersonItem
        media={<EntityAvatar fullName="Iryna Shevchenko" tint="warning" />}
        name="Iryna Shevchenko"
        subtitle="Mother · pays for lessons"
        action={
          <Button variant="white" size="icon-md" aria-label="Call Iryna Shevchenko">
            <PhoneIcon />
          </Button>
        }
      />
      <PersonItem
        tone="soft"
        media={<EntityAvatar avatarKey="user-1" fullName="Olena Kovalenko" size="sm" />}
        name="Olena Kovalenko"
        subtitle="Owner"
        size="sm"
        trail={<MoreVerticalIcon className="size-4.5" />}
      />
      <PersonItem
        tone="ink"
        media={<EntityAvatar avatarKey="user-2" fullName="Dmytro Tutor" size="sm" />}
        name="Dmytro Tutor"
        subtitle="Room 2 · uses 1 credit"
        size="sm"
      />
      <PersonItem
        tone="soft"
        media={<PersonItemTile initials="K" />}
        name="Kyiv English Studio"
        subtitle="School · 3 teachers"
        size="sm"
        trail={<ChevronDownIcon className="size-4" />}
      />
      <PersonItem
        media={<EntityAvatar fullName="Viktoriia Hnatiuk" tint="indigo" />}
        name="Viktoriia Hnatiuk"
        subtitle="Student · B1"
        action={
          <Button variant="white" size="icon-md" aria-label="Message Viktoriia Hnatiuk">
            <SendIcon />
          </Button>
        }
      />
    </div>
  ),
};

export const PeopleUkrainian: Story = {
  globals: { locale: 'uk' },
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <PersonItem
        media={<EntityAvatar fullName="Ірина Шевченко" tint="warning" />}
        name="Ірина Шевченко"
        subtitle="Мама · оплачує заняття"
        action={
          <Button variant="white" size="icon-md" aria-label="Зателефонувати Ірині Шевченко">
            <PhoneIcon />
          </Button>
        }
      />
      <PersonItem
        tone="soft"
        media={<PersonItemTile initials="Н" />}
        name="Навчальна майстерня української та англійської мов"
        subtitle="Школа · 3 викладачі"
        size="sm"
        trail={<ChevronDownIcon className="size-4" />}
      />
    </div>
  ),
};

export const AvatarStatus: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-6">
      <EntityAvatar avatarKey="user-1" fullName="Anna Shevchenko" status="active" />
      <EntityAvatar avatarKey="user-3" fullName="Oleksii Koval" status="hold" />
      <EntityAvatar fullName="Kateryna Bondarenko" status="archived" />
      <EntityAvatar avatarKey="user-2" fullName="Anna Shevchenko" size="2xl" ring="hero" />
    </div>
  ),
};

export const Credits: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-10">
        <CreditMeter left={6} total={8} label="6 of 8 left" />
        <CreditMeter left={1} total={8} label="1 of 8 left" />
        <CreditMeter left={0} total={8} label="No credits left" />
        <CreditMeter left={6} total={10} label="6 of 10 left" />
        <CreditMeter left={0} total={0} label="No active package" />
      </div>
      <div className="max-w-sm rounded-card bg-tint-info p-5">
        <CreditMeter size="lg" left={6} total={8} usedLabel="2 used" leftLabel="6 left" />
      </div>
    </div>
  ),
};
