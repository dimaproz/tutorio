import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { LoginForm } from './login-form';

type Args = { requestError: string; pending: boolean; defaultPasswordVisible: boolean };

/**
 * The sign-in form. Locale, theme and viewport come from the toolbar; the
 * request states come from the controls below.
 */
function LoginStory({ requestError, pending, defaultPasswordVisible }: Args) {
  return (
    <div className="mx-auto w-full max-w-110">
      <LoginForm
        requestError={requestError || undefined}
        pending={pending}
        defaultPasswordVisible={defaultPasswordVisible}
        onSubmit={async () => undefined}
      />
    </div>
  );
}

function FailureStory() {
  const [error, setError] = useState<string>();
  return (
    <div className="mx-auto w-full max-w-110">
      <LoginForm
        requestError={error}
        onSubmit={async () => setError('Incorrect email or password.')}
      />
    </div>
  );
}

const keyboardSubmit = fn();

const meta = {
  title: 'Auth/LoginForm',
  component: LoginStory,
  args: { requestError: '', pending: false, defaultPasswordVisible: false },
  argTypes: {
    requestError: { description: 'The wrong-credentials banner under the form.' },
  },
} satisfies Meta<typeof LoginStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Create one' })).toHaveAttribute(
      'href',
      '/register',
    );
  },
};

export const ValidationError: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
    const email = canvas.getByRole('textbox', { name: 'Email' });
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    await expect(email).toHaveFocus();
  },
};

export const KeyboardSubmit: Story = {
  render: () => <LoginForm onSubmit={keyboardSubmit} />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'olena@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'correct horse battery');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(keyboardSubmit).toHaveBeenCalledOnce());
  },
};

export const PasswordToggle: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show password' }));
    await expect(canvas.getByLabelText('Password')).toHaveAttribute('type', 'text');
    await userEvent.click(canvas.getByRole('button', { name: 'Hide password' }));
    await expect(canvas.getByLabelText('Password')).toHaveAttribute('type', 'password');
  },
};

export const RequestFailureRetainsInput: Story = {
  render: () => <FailureStory />,
  play: async ({ canvas }) => {
    const email = canvas.getByRole('textbox', { name: 'Email' });
    const password = canvas.getByLabelText('Password');
    await userEvent.type(email, 'olena@example.com');
    await userEvent.type(password, 'correct horse battery');
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible());
    await expect(email).toHaveValue('olena@example.com');
    await expect(password).toHaveValue('correct horse battery');
  },
};
