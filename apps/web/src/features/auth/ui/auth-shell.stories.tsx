import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '@/components/ui/button';
import { NarrowStoryContainer } from '@/stories/story-helpers';
import { AuthShell } from './auth-shell';
import { LoginForm } from './login-form';

async function noOp() {}

function AuthShellStory() {
  return <AuthShell localeControl={<Button variant="ghost" size="icon" aria-label="Change language">EN</Button>}><div className="mx-auto w-full max-w-sm"><LoginForm onSubmit={noOp} /></div></AuthShell>;
}

const meta = {
  title: 'Auth/Shell',
  component: AuthShellStory,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AuthShellStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const Mobile320: Story = {
  render: () => <NarrowStoryContainer><AuthShellStory /></NarrowStoryContainer>,
};
