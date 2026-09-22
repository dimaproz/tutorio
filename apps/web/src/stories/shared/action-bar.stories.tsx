import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ActionBar } from '@/components/shared/action-bar';

type Args = {
  note: string;
  tone: 'muted' | 'danger' | 'warning' | 'success';
  primary: string;
  secondary: string;
  back: string;
  state: 'ready' | 'busy' | 'disabled';
};

/** The sticky save bar. `state` drives the buttons the way a mutation would. */
function ActionBarStory({ note, tone, primary, secondary, back, state }: Args) {
  const busy = state === 'busy';
  return (
    <div className="w-270 max-w-full">
      <ActionBar
        sticky={false}
        note={note || undefined}
        tone={tone}
        back={
          back ? (
            <Button type="button" variant="ghost">
              <ArrowLeftIcon data-icon="inline-start" />
              {back}
            </Button>
          ) : undefined
        }
        secondary={
          secondary ? (
            <Button type="button" variant="outline" disabled={busy}>
              {secondary}
            </Button>
          ) : undefined
        }
        primary={
          <Button type="button" disabled={state !== 'ready'}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {primary}
          </Button>
        }
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/ActionBar',
  component: ActionBarStory,
  args: {
    note: 'Draft saved on this device',
    tone: 'muted',
    primary: 'Create student',
    secondary: 'Cancel',
    back: '',
    state: 'ready',
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['muted', 'danger', 'warning', 'success'] },
    state: { control: 'inline-radio', options: ['ready', 'busy', 'disabled'] },
  },
} satisfies Meta<typeof ActionBarStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Errors: Story = {
  args: { note: 'Fix 2 fields to save', tone: 'danger', state: 'disabled' },
};

export const UnsavedEdit: Story = {
  args: {
    note: '3 unsaved changes',
    tone: 'warning',
    primary: 'Save changes',
    secondary: 'Discard',
    back: 'Students',
  },
};
