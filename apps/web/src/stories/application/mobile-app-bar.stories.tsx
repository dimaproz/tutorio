import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MobileAppBarContent } from '@/components/app/mobile-app-bar';

type Args = { mode: 'home' | 'back'; title: string };

/** The phone top bar: `home` on a section root, `back` on a detail route. */
function MobileAppBarStory({ mode, title }: Args) {
  return (
    <div className="w-97.5 bg-background px-4">
      <MobileAppBarContent
        pathname={mode === 'home' ? '/app/students' : '/app/students/d6bf671d'}
        crumb={title || undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Application/MobileAppBar',
  component: MobileAppBarStory,
  args: { mode: 'home', title: 'Profile' },
  argTypes: {
    mode: { control: 'inline-radio', options: ['home', 'back'] },
    title: { if: { arg: 'mode', eq: 'back' }, description: 'The page’s crumb, centred.' },
  },
} satisfies Meta<typeof MobileAppBarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Back: Story = {
  args: { mode: 'back' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Students' })).toHaveAttribute(
      'href',
      '/app/students',
    );
    await expect(canvas.getByText('Profile')).toBeVisible();
  },
};
