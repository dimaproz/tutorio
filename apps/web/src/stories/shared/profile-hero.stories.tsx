import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';
import {
  MailIcon,
  MoreVerticalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { ProfileHero } from '@/components/shared/profile-hero';
import { StatusTrigger, type LifecycleTone } from '@/components/shared/status-trigger';

type Args = {
  name: string;
  status: LifecycleTone;
  dateLabel: string;
  meta: string;
  glyph: string;
  withImage: boolean;
  email: boolean;
  menu: boolean;
};

const STATUS_LABEL: Record<LifecycleTone, string> = {
  active: 'Active',
  hold: 'On a break',
  archived: 'Archived',
};

/**
 * The tinted profile header. Actions follow the status like the student
 * profile: active schedules and edits, on a break only edits, archived only
 * restores. Resize the canvas below 768px for the phone layout.
 */
function ProfileHeroStory({ name, status, dateLabel, meta, glyph, withImage, email, menu }: Args) {
  const contact = (label: string, icon: ReactNode) => (
    <Button variant="white" size="icon" aria-label={label}>
      {icon}
    </Button>
  );
  const restore = (
    <Button variant="white">
      <RotateCcwIcon data-icon="inline-start" />
      Restore
    </Button>
  );
  const edit = (
    <Button variant="white">
      <PencilIcon data-icon="inline-start" />
      Edit
    </Button>
  );

  return (
    <div className="max-w-230">
      <ProfileHero
        glyph={glyph || undefined}
        dim={status === 'archived'}
        avatar={
          <EntityAvatar
            fullName={name}
            avatarKey={withImage ? 'user-1' : null}
            size="2xl"
            ring="hero"
            tint="surface"
          />
        }
        badges={
          <>
            <StatusTrigger
              tone={status}
              label={STATUS_LABEL[status]}
              aria-label={`Status: ${STATUS_LABEL[status]}`}
            />
            <Badge variant="on-tint" size="lg">
              {dateLabel}
            </Badge>
          </>
        }
        name={name}
        meta={meta
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)}
        contacts={
          <>
            {contact('Call', <PhoneIcon />)}
            {contact('Message on Telegram', <SendIcon />)}
            {email ? contact('Email', <MailIcon />) : null}
          </>
        }
        primaryAction={
          status === 'active' ? <Button leading={<PlusIcon />}>Schedule lesson</Button> : undefined
        }
        actions={status === 'archived' ? restore : edit}
        menu={
          menu ? (
            <Button variant="translucent" size="icon-sm" aria-label="Record actions">
              <MoreVerticalIcon />
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/ProfileHero',
  component: ProfileHeroStory,
  args: {
    name: 'Anna Shevchenko',
    status: 'active',
    dateLabel: 'Added 20 Aug 2026',
    meta: 'B2 — upper intermediate, Intermediate, 15 y.o., Grade 10',
    glyph: 'B2',
    withImage: true,
    email: true,
    menu: false,
  },
  argTypes: {
    status: { control: 'inline-radio', options: ['active', 'hold', 'archived'] },
    meta: { description: 'Comma-separated meta values.' },
    glyph: { description: 'Decorative background letters; empty hides them.' },
    email: { description: 'E-mail is shown only when known.' },
    menu: { description: 'The record overflow trigger in the top-right corner.' },
  },
} satisfies Meta<typeof ProfileHeroStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Archived: Story = {
  args: {
    name: 'Kateryna Bondarenko',
    status: 'archived',
    dateLabel: 'Archived 1 Sep 2026',
    meta: 'A2 — elementary, 14 y.o.',
    glyph: 'A2',
  },
};
