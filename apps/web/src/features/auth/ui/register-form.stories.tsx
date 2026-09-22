import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { RegisterForm } from './register-form';

type Args = {
  defaultMode: 'SOLO' | 'SCHOOL';
  requestError: string;
  pending: boolean;
  defaultPasswordVisible: boolean;
};

/** The create-workspace form. The school choice adds the workspace name. */
function RegisterStory({ defaultMode, requestError, pending, defaultPasswordVisible }: Args) {
  return (
    <div className="mx-auto w-full max-w-130">
      <RegisterForm
        key={defaultMode}
        defaultMode={defaultMode}
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
    <RegisterForm
      requestError={error}
      onSubmit={async () => setError('This email is already registered. Try signing in instead.')}
    />
  );
}

const keyboardSubmit = fn();

const meta = {
  title: 'Auth/RegisterForm',
  component: RegisterStory,
  args: { defaultMode: 'SOLO', requestError: '', pending: false, defaultPasswordVisible: false },
  argTypes: { defaultMode: { control: 'inline-radio', options: ['SOLO', 'SCHOOL'] } },
} satisfies Meta<typeof RegisterStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  },
};

export const ValidationError: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create workspace' }));
    const name = canvas.getByRole('textbox', { name: 'Your name' });
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    await expect(name).toHaveFocus();
  },
};

export const ModeSwitching: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByLabelText('Workspace name')).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole('radio', { name: /We are a school with several teachers/ }),
    );
    await expect(canvas.getByLabelText('Workspace name')).toBeVisible();
    await userEvent.click(canvas.getByRole('radio', { name: /I tutor on my own/ }));
    await expect(canvas.queryByLabelText('Workspace name')).not.toBeInTheDocument();
  },
};

export const KeyboardSubmit: Story = {
  render: () => <RegisterForm onSubmit={keyboardSubmit} />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your name' }), 'Olena');
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'olena@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'correct horse battery');
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'correct horse battery');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(keyboardSubmit).toHaveBeenCalledOnce());
  },
};

export const RequestFailureRetainsInput: Story = {
  render: () => <FailureStory />,
  play: async ({ canvas }) => {
    const email = canvas.getByRole('textbox', { name: 'Email' });
    await userEvent.type(canvas.getByRole('textbox', { name: 'Your name' }), 'Olena');
    await userEvent.type(email, 'olena@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'correct horse battery');
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'correct horse battery');
    await userEvent.click(canvas.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible());
    await expect(email).toHaveValue('olena@example.com');
  },
};
