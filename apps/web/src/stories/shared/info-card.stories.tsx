import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MailIcon, PencilIcon, PhoneIcon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactRow } from '@/components/shared/contact-row';
import { InfoCard } from '@/components/shared/info-card';

type Args = { title: string; tone: 'surface' | 'warning' | 'info' | 'indigo'; withAction: boolean };

/** A titled aside block of rows: contacts, notes, parents. */
function InfoCardStory({ title, tone, withAction }: Args) {
  return (
    <div className="w-87.5">
      <InfoCard
        title={title}
        tone={tone}
        action={
          withAction ? (
            <Button variant="translucent" size="icon-xs" aria-label="Edit">
              <PencilIcon />
            </Button>
          ) : undefined
        }
      >
        <ContactRow icon={PhoneIcon} mono>
          +380 50 111 22 33
        </ContactRow>
        <ContactRow icon={SendIcon}>@anna_s</ContactRow>
        <ContactRow icon={MailIcon}>anna@example.test</ContactRow>
      </InfoCard>
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/InfoCard',
  component: InfoCardStory,
  args: { title: 'Contacts', tone: 'surface', withAction: false },
  argTypes: {
    tone: { control: 'inline-radio', options: ['surface', 'warning', 'info', 'indigo'] },
  },
} satisfies Meta<typeof InfoCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
