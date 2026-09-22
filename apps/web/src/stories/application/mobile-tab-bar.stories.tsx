import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { MobileTabBarContent } from '@/components/app/mobile-tab-bar';

type Args = { pathname: string; onMore: () => void };

/**
 * The phone tab bar, fixed to the bottom with the safe-area inset. "More"
 * opens the full navigation sheet. Use the Handoff mobile viewport to see it.
 */
function MobileTabBarStory({ pathname, onMore }: Args) {
  return (
    <div className="relative h-40 w-97.5 bg-background [&_nav]:absolute [&_nav]:flex">
      <MobileTabBarContent pathname={pathname} onMore={onMore} />
    </div>
  );
}

const meta = {
  title: 'Application/MobileTabBar',
  component: MobileTabBarStory,
  args: { pathname: '/app/students', onMore: fn() },
  argTypes: {
    pathname: {
      control: 'select',
      options: ['/app', '/app/calendar', '/app/students', '/app/packages'],
    },
  },
} satisfies Meta<typeof MobileTabBarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('link', { name: 'Students' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'More' }));
    await expect(args.onMore).toHaveBeenCalled();
  },
};
