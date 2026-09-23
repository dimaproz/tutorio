import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FileTextIcon, PhoneIcon, UserIcon } from 'lucide-react';
import { expect } from 'storybook/test';
import { ActionBar } from '@/components/shared/action-bar';
import { FormPageLayout } from '@/components/shared/form-page-layout';
import { FormSectionCard } from '@/components/shared/form-section';
import { Notice } from '@/components/shared/notice';
import { ProgressMeter } from '@/components/shared/progress-meter';
import type { SectionNavItem } from '@/components/shared/section-nav';
import { Button } from '@/components/ui/button';

type Args = { navLoading: boolean; progress: boolean; notice: boolean };

const SECTIONS: SectionNavItem[] = [
  {
    id: 'demo-identity',
    icon: <UserIcon />,
    title: 'Personal details',
    description: 'Avatar and name',
    status: 'done',
  },
  {
    id: 'demo-contacts',
    icon: <PhoneIcon />,
    title: 'Contact details',
    description: 'Email, phone, Telegram',
    status: 'error',
  },
  {
    id: 'demo-notes',
    icon: <FileTextIcon />,
    title: 'Notes',
    description: 'Worth remembering',
    status: 'none',
  },
];

/**
 * The frame every full-page entity form shares: header, section navigation
 * (chips below `md`), an optional block under it, the sections and the save
 * bar. `navLoading` shows the navigation skeleton of a record that is still
 * loading; `progress` adds the meter; `notice` the banner above the sections.
 */
function FormPageLayoutStory({ navLoading, progress, notice }: Args) {
  const done = SECTIONS.filter((item) => item.status === 'done').length;
  return (
    <FormPageLayout
      title="New parent"
      subtitle="Only the name is required — add the rest later."
      navItems={SECTIONS}
      activeSection="demo-identity"
      labels={{ sections: 'Form sections', error: 'Has an error', done: 'Complete' }}
      navNote="Scrolling highlights the current section."
      navAside={
        progress ? (
          <ProgressMeter
            value={done}
            total={SECTIONS.length}
            label={`${done} of ${SECTIONS.length} filled`}
            caption="ready to create"
          />
        ) : undefined
      }
      navLoading={navLoading}
      notice={
        notice ? (
          <Notice tone="danger" title="Couldn’t save the record" text="Try again in a moment." />
        ) : undefined
      }
      bar={
        <ActionBar
          tone="muted"
          note="Only the name is required"
          secondary={<Button variant="outline">Cancel</Button>}
          primary={<Button>Create record</Button>}
        />
      }
    >
      {SECTIONS.map((section) => (
        <FormSectionCard
          key={section.id}
          id={section.id}
          icon={section.icon}
          title={section.title}
          description={section.description}
          invalid={section.status === 'error'}
        >
          <p className="text-sm text-muted-foreground">Section fields go here.</p>
        </FormSectionCard>
      ))}
    </FormPageLayout>
  );
}

const meta = {
  title: 'Shared/Form/FormPageLayout',
  component: FormPageLayoutStory,
  parameters: { layout: 'padded' },
  args: { navLoading: false, progress: true, notice: false },
} satisfies Meta<typeof FormPageLayoutStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'New parent' })).toBeVisible();
    // The progress caption sits on its own line under the bars.
    await expect(canvas.getByText('ready to create')).toBeVisible();
  },
};
