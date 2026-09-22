import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  PhoneIcon,
  UserIcon,
  WalletCardsIcon,
} from 'lucide-react';
import { expect } from 'storybook/test';
import { SectionChips, SectionNav, type SectionNavStatus } from '@/components/shared/section-nav';

const SECTIONS = [
  { id: 'identity', icon: <UserIcon />, title: 'Personal details', description: 'Avatar and name' },
  { id: 'contacts', icon: <PhoneIcon />, title: 'Contacts', description: 'Email, phone, Telegram' },
  {
    id: 'learning',
    icon: <GraduationCapIcon />,
    title: 'Learning profile',
    description: 'Age, grade and levels',
  },
  { id: 'preferences', icon: <ClockIcon />, title: 'Preferences', description: 'Timezone' },
  {
    id: 'pricing',
    icon: <WalletCardsIcon />,
    title: 'Price',
    description: 'Price per lesson and currency',
  },
  { id: 'notes', icon: <FileTextIcon />, title: 'Notes', description: 'Worth remembering' },
];

type Args = {
  layout: 'nav' | 'chips';
  active: number;
  contacts: SectionNavStatus;
  pricing: SectionNavStatus;
  note: string;
};

/**
 * The form's section navigation: the 280px list on desktop, the scrolling
 * chip row on phones. Set a section's status to `error` for the red mark.
 */
function SectionNavStory({ layout, active, contacts, pricing, note }: Args) {
  const [current, setCurrent] = useState(SECTIONS[active]?.id);
  const items = SECTIONS.map((section) => ({
    ...section,
    status:
      section.id === 'contacts'
        ? contacts
        : section.id === 'pricing'
          ? pricing
          : section.id === 'identity' || section.id === 'preferences'
            ? ('done' as const)
            : ('none' as const),
  }));
  const labels = { label: 'Form sections', errorLabel: 'Has an error', doneLabel: 'Complete' };

  return layout === 'chips' ? (
    <div className="w-97.5 max-w-full">
      <SectionChips {...labels} items={items} active={current} onSelect={setCurrent} />
    </div>
  ) : (
    <div className="w-70">
      <SectionNav
        {...labels}
        items={items}
        active={current}
        onSelect={setCurrent}
        note={note || undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/SectionNav',
  component: SectionNavStory,
  args: { layout: 'nav', active: 0, contacts: 'done', pricing: 'done', note: '' },
  argTypes: {
    layout: {
      control: 'inline-radio',
      options: ['nav', 'chips'],
      description: '`chips` is SectionChips.',
    },
    active: { control: { type: 'range', min: 0, max: 5 } },
    contacts: { control: 'inline-radio', options: ['none', 'done', 'error'] },
    pricing: { control: 'inline-radio', options: ['none', 'done', 'error'] },
  },
} satisfies Meta<typeof SectionNavStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithErrors: Story = {
  args: { contacts: 'error', pricing: 'error', note: '2 sections need attention' },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('img', { name: 'Has an error' })).toHaveLength(2);
    await expect(canvas.getByRole('link', { name: /Personal details/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  },
};

export const Chips: Story = { args: { layout: 'chips', active: 1 } };
