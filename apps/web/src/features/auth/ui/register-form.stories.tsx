import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { NarrowStoryContainer } from '@/stories/story-helpers';
import { RegisterForm } from './register-form';

async function noOp() {}
const keyboardSubmit = fn();

function RegisterStory(props: Omit<React.ComponentProps<typeof RegisterForm>, 'onSubmit'>) {
  return <RegisterForm {...props} onSubmit={noOp} />;
}

function FailureStory() {
  const [error, setError] = useState<string>();
  return <RegisterForm requestError={error} onSubmit={async () => setError('This email is already registered. Try signing in instead.')} />;
}

const meta = {
  title: 'Auth/Register',
  component: RegisterStory,
  decorators: [(Story) => <div className="mx-auto w-full max-w-md"><Story /></div>],
} satisfies Meta<typeof RegisterStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Solo: Story = {};
export const School: Story = { args: { defaultMode: 'SCHOOL' } };
export const ValidationError: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(canvas.getByText('Enter your name')).toBeVisible());
    await expect(canvas.getByLabelText('Your name')).toHaveFocus();
  },
};
export const EmailTaken: Story = { args: { requestError: 'This email is already registered. Try signing in instead.' } };
export const Pending: Story = { args: { pending: true } };
export const Mobile: Story = { render: () => <NarrowStoryContainer><RegisterStory /></NarrowStoryContainer> };
export const Dark: Story = { globals: { theme: 'dark' } };
export const Ukrainian: Story = { globals: { locale: 'uk' } };
export const English: Story = { globals: { locale: 'en' } };
export const ModeSwitching: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByLabelText('Workspace name')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('radio', { name: 'We are a school with several teachers' }));
    await expect(canvas.getByLabelText('Workspace name')).toBeVisible();
    await userEvent.click(canvas.getByRole('radio', { name: 'I tutor on my own' }));
    await expect(canvas.queryByLabelText('Workspace name')).not.toBeInTheDocument();
  },
};
export const KeyboardSubmit: Story = {
  render: () => <RegisterForm onSubmit={keyboardSubmit} />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Your name'), 'Olena');
    await userEvent.type(canvas.getByLabelText('Email'), 'olena@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'correct horse battery');
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'correct horse battery');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(keyboardSubmit).toHaveBeenCalledOnce());
  },
};
export const RequestFailureRetainsInput: Story = {
  render: () => <FailureStory />,
  play: async ({ canvas }) => {
    const email = canvas.getByLabelText('Email');
    await userEvent.type(canvas.getByLabelText('Your name'), 'Olena');
    await userEvent.type(email, 'olena@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'correct horse battery');
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'correct horse battery');
    await userEvent.click(canvas.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(canvas.getByRole('alert')).toBeVisible());
    await expect(email).toHaveValue('olena@example.com');
  },
};
export const NavigationLink: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  },
};
