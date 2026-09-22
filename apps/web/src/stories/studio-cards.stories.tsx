import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ArrowLeftIcon,
  FilterIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SendIcon,
  UsersIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContactRow } from '@/components/shared/contact-row';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FilterPill } from '@/components/shared/filter-pill';
import { InfoCard } from '@/components/shared/info-card';
import { NextLessonCard } from '@/components/shared/next-lesson-card';
import { PersonItem } from '@/components/shared/person-item';
import { ProfileHero } from '@/components/shared/profile-hero';
import { SearchField } from '@/components/shared/search-field';

const meta = { title: 'Shared/Studio cards' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const teacherRow = (
  <PersonItem
    tone="ink"
    size="sm"
    media={<EntityAvatar avatarKey="user-2" fullName="Dmytro Tutor" size="sm" />}
    name="Dmytro Tutor"
    subtitle="Room 2 · uses 1 credit"
  />
);

export const NextLessonScheduled: Story = {
  render: () => (
    <div className="max-w-md">
      <NextLessonCard
        heading="Next lesson"
        relative="in 2 days"
        date="Thu, 11 Sep"
        time="17:00 – 18:00 · Speaking"
        teacher={teacherRow}
        primaryAction={<Button variant="soft">Open lesson</Button>}
        secondaryAction={<Button variant="dark-outline">Reschedule</Button>}
      />
    </div>
  ),
};

export const NextLessonEmpty: Story = {
  render: () => (
    <div className="max-w-md">
      <NextLessonCard
        heading="Next lesson"
        emptyTitle="Nothing planned"
        emptyDescription="Book the next lesson so the package keeps moving."
        emptyAction={
          <Button variant="soft" leading={<PlusIcon />}>
            Schedule lesson
          </Button>
        }
      />
    </div>
  ),
};

export const NextLessonLoading: Story = {
  render: () => (
    <div className="max-w-md">
      <NextLessonCard heading="Next lesson" loading />
    </div>
  ),
};

const contactButtons = (
  <>
    <Button variant="white" size="icon" aria-label="Call +380 50 111 22 33">
      <PhoneIcon />
    </Button>
    <Button variant="white" size="icon" aria-label="Message @anna_s on Telegram">
      <SendIcon />
    </Button>
    <Button variant="white" size="icon" aria-label="Email anna@example.test">
      <MailIcon />
    </Button>
  </>
);

const heroActions = (
  <>
    <Button leading={<PlusIcon />}>Schedule lesson</Button>
    <Button variant="white">
      <PencilIcon data-icon="inline-start" />
      Edit profile
    </Button>
  </>
);

export const Hero: Story = {
  render: () => (
    <ProfileHero
      glyph="B2"
      avatar={
        <EntityAvatar avatarKey="user-1" fullName="Anna Shevchenko" size="2xl" ring="hero" />
      }
      badges={
        <>
          <Badge variant="surface" size="lg" dot>
            Active
          </Badge>
          <Badge variant="on-tint" size="lg">
            Student since Aug 2026
          </Badge>
        </>
      }
      name="Anna Shevchenko"
      meta={['English · B2 Upper-intermediate', 'Grade 10 · 15 y.o.', 'Kyiv, GMT+3']}
      contacts={contactButtons}
      actions={heroActions}
    />
  ),
};

/** No picked illustration and no level: initials and a plain card. */
export const HeroWithoutAvatarOrGlyph: Story = {
  render: () => (
    <ProfileHero
      avatar={<EntityAvatar fullName="Kateryna Bondarenko" size="2xl" ring="hero" tint="indigo" />}
      badges={
        <Badge variant="surface" size="lg" dot>
          Active
        </Badge>
      }
      name="Kateryna Bondarenko"
      meta={['Not configured']}
      actions={heroActions}
    />
  ),
};

export const HeroLongUkrainianName: Story = {
  globals: { locale: 'uk' },
  render: () => (
    <ProfileHero
      glyph="B1"
      avatar={
        <EntityAvatar avatarKey="user-4" fullName="Олександра Височенко" size="2xl" ring="hero" />
      }
      badges={
        <Badge variant="surface" size="lg" dot>
          Активна
        </Badge>
      }
      name="Олександра Миколаївна Височенко-Петренко"
      meta={['Англійська · B1', '10 клас · 15 р.', 'Київ, GMT+3']}
      contacts={contactButtons}
      actions={heroActions}
    />
  ),
};

export const Contacts: Story = {
  render: () => (
    <div className="grid max-w-sm gap-4">
      <InfoCard title="Contacts">
        <ContactRow icon={PhoneIcon} mono>
          +380 50 111 22 33
        </ContactRow>
        <ContactRow icon={SendIcon}>@anna_s</ContactRow>
        <ContactRow icon={MailIcon}>anna@example.test</ContactRow>
      </InfoCard>
      <InfoCard
        title="Family"
        action={
          <Button variant="link" size="xs" className="px-0">
            + Link parent
          </Button>
        }
      >
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
      </InfoCard>
    </div>
  ),
};

export const SearchAndFilters: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="w-85">
        <SearchField
          label="Search students, lessons, payments"
          placeholder="Search students, lessons, payments"
          shortcut="⌘K"
        />
      </div>
      <div className="w-85">
        <SearchField
          label="Search students"
          placeholder="Search students"
          defaultValue="Anna"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterPill label="Group" menu />
        <FilterPill label="Teacher" menu count={2} />
        <FilterPill label="Low credits" icon={<FilterIcon />} pressed={false} />
        <FilterPill label="Low credits" icon={<FilterIcon />} pressed />
        <FilterPill label="Students" icon={<UsersIcon />} />
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowLeftIcon data-icon="inline-start" />
          Students
        </Button>
      </div>
    </div>
  ),
};
