import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ClockIcon, PhoneIcon, WalletCardsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ContactRow } from '@/components/shared/contact-row';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { EntityPreview } from '@/components/shared/entity-preview';

type Args = {
  heading: string;
  person: string;
  withImage: boolean;
  status: 'active' | 'hold' | 'archived';
  withRows: boolean;
  emptyText: string;
};

const STATUS = {
  active: { label: 'Active', variant: 'success-inverse' },
  hold: { label: 'On a break', variant: 'warning' },
  archived: { label: 'Archived', variant: 'neutral' },
} as const;

function EntityPreviewStory({ heading, person, withImage, status, withRows, emptyText }: Args) {
  return (
    <div className="w-70">
      <EntityPreview
        heading={heading}
        avatar={
          <EntityAvatar
            fullName={person}
            avatarKey={withImage ? 'user-3' : null}
            tint="surface"
            className="size-14 ring-3 ring-card"
          />
        }
        name={person}
        status={
          <Badge variant={STATUS[status].variant} dot>
            {STATUS[status].label}
          </Badge>
        }
        rows={
          withRows ? (
            <>
              <ContactRow icon={PhoneIcon} mono>
                +380 67 123 45 67
              </ContactRow>
              <ContactRow icon={ClockIcon}>Europe/Kyiv</ContactRow>
              <ContactRow icon={WalletCardsIcon}>450 ₴ per lesson</ContactRow>
            </>
          ) : undefined
        }
        emptyText={emptyText}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/EntityPreview',
  component: EntityPreviewStory,
  args: {
    heading: 'How the student will look',
    person: 'Sofiia Melnyk',
    withImage: false,
    status: 'active',
    withRows: false,
    emptyText: 'Contacts, price and timezone appear here as soon as you fill them in.',
  },
  argTypes: { status: { control: 'inline-radio', options: ['active', 'hold', 'archived'] } },
} satisfies Meta<typeof EntityPreviewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
