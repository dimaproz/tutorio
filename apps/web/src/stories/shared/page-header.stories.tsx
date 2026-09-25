import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-shell';

type Args = { title: string; subtitle: string; size: 'lg' | 'xl'; action: string };

function PageHeaderStory({ title, subtitle, size, action }: Args) {
  return (
    <PageHeader
      size={size}
      title={title}
      description={subtitle || undefined}
      action={
        action ? (
          <Button size="xl" leading={<PlusIcon />}>
            {action}
          </Button>
        ) : undefined
      }
    />
  );
}

const meta = {
  title: 'Shared/Page/PageHeader',
  component: PageHeaderStory,
  args: {
    title: 'New student',
    subtitle: 'Fill in the essentials now — the rest can wait.',
    size: 'lg',
    action: '',
  },
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['lg', 'xl'],
      description: '`lg` 48px titles a form page; `xl` 64px titles a collection.',
    },
  },
} satisfies Meta<typeof PageHeaderStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Collection: Story = {
  args: {
    title: 'Students',
    subtitle: '48 students · 39 active',
    size: 'xl',
    action: 'New student',
  },
};

/**
 * A long action beside a collection title in a tablet's column (about 540px
 * beside the sidebar): the action wraps under the title instead of running
 * off the page (S09).
 */
export const NarrowColumn: Story = {
  args: {
    title: 'Викладачі',
    subtitle: '5 викладачів · 1 в архіві',
    size: 'xl',
    action: 'Додати викладача',
  },
  decorators: [
    (Story) => (
      <div className="w-[540px] max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const header = canvasElement.firstElementChild as HTMLElement;
    const button = canvasElement.querySelector('button')!;
    await expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
      header.getBoundingClientRect().right + 1,
    );
  },
};
