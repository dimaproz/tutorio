import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { NarrowStoryContainer } from '@/stories/story-helpers';
import { LoginForm } from './login-form';

async function noOp() {}
const keyboardSubmit = fn();

function LoginStory(props: Omit<React.ComponentProps<typeof LoginForm>, 'onSubmit'>) {
  return <LoginForm {...props} onSubmit={noOp} />;
}

function FailureStory() {
  const [error, setError] = useState<string>();
  return <LoginForm requestError={error} onSubmit={async () => setError('Incorrect email or password.')} />;
}

const meta = {
  title: 'Auth/Login',
  component: LoginStory,
  decorators: [(Story) => <div className="mx-auto w-full max-w-sm"><Story /></div>],
} satisfies Meta<typeof LoginStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ValidationError: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(canvas.getByText('Enter a valid email address')).toBeVisible());
    await expect(canvas.getByLabelText('Email')).toHaveFocus();
  },
};
export const ApiError: Story = { args: { requestError: 'Incorrect email or password.' } };
export const Pending: Story = { args: { pending: true } };
export const PasswordVisible: Story = { args: { defaultPasswordVisible: true } };
export const Mobile: Story = { render: () => <NarrowStoryContainer><LoginStory /></NarrowStoryContainer> };
export const Dark: Story = { globals: { theme: 'dark' } };
export const Ukrainian: Story = { globals: { locale: 'uk' } };
export const English: Story = { globals: { locale: 'en' } };
export const KeyboardSubmit: Story = {
  render: () => <LoginForm onSubmit={keyboardSubmit} />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'olena@example.com');
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
    const email = canvas.getByLabelText('Email');
    const password = canvas.getByLabelText('Password');
    await userEvent.type(email, 'olena@example.com');
    await userEvent.type(password, 'correct horse battery');
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible());
    await expect(email).toHaveValue('olena@example.com');
    await expect(password).toHaveValue('correct horse battery');
  },
};
export const NavigationLink: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/register');
  },
};
