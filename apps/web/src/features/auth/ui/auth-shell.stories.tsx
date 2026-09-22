import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { LocaleSegmented } from '@/components/locale-switcher';
import { AuthShell } from './auth-shell';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

type Args = {
  screen: 'login' | 'register';
  requestError: string;
  registerMode: 'SOLO' | 'SCHOOL';
};

/**
 * The sign-in and create-workspace screens with their frame: the form card
 * beside the indigo panel on desktop, the indigo band above an overlapping
 * card on phones (viewport toolbar: Handoff mobile 390).
 */
function AuthScreen({ screen, requestError, registerMode }: Args) {
  return (
    <AuthShell variant={screen} localeControl={<LocaleSegmented />}>
      {screen === 'login' ? (
        <LoginForm requestError={requestError || undefined} onSubmit={async () => undefined} />
      ) : (
        <RegisterForm
          key={registerMode}
          defaultMode={registerMode}
          requestError={requestError || undefined}
          onSubmit={async () => undefined}
        />
      )}
    </AuthShell>
  );
}

const meta = {
  title: 'Auth/Screens',
  component: AuthScreen,
  parameters: { layout: 'fullscreen', fullBleed: true },
  args: { screen: 'login', requestError: '', registerMode: 'SCHOOL' },
  argTypes: {
    screen: { control: 'inline-radio', options: ['login', 'register'] },
    registerMode: {
      control: 'inline-radio',
      options: ['SOLO', 'SCHOOL'],
      if: { arg: 'screen', eq: 'register' },
    },
  },
} satisfies Meta<typeof AuthScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
    await expect(getComputedStyle(canvas.getByRole('heading', { level: 1 })).fontFamily).toMatch(
      /geist/i,
    );
  },
};

export const Register: Story = { args: { screen: 'register' } };
