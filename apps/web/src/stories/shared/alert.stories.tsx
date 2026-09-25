import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '@/components/ui/button';
import type { GlyphName } from '@/components/shared/glyph';
import { Notice, type NoticeAppearance, type NoticeTone } from '@/components/shared/notice';
import { glyphControl, glyphNode } from '../story-helpers';

type Args = {
  tone: NoticeTone;
  appearance: NoticeAppearance;
  icon: GlyphName | 'none';
  title: string;
  text: string;
  action: string;
  actionIcon: GlyphName | 'none';
};

/**
 * The design's `Alert`: a tinted banner with the tone's glyph and an optional
 * action, or the `callout` a decision dialog explains itself with (white icon
 * tile, title in the tone colour). `indigo` and `neutral` are callout tones.
 */
function AlertStory({ tone, appearance, icon, title, text, action, actionIcon }: Args) {
  return (
    <div className="w-180 max-w-full">
      <Notice
        tone={tone}
        appearance={appearance}
        icon={glyphNode(icon)}
        title={title || undefined}
        text={text}
        action={
          action ? (
            <Button type="button" variant="white" size="xs">
              {actionIcon !== 'none' ? (
                <span data-icon="inline-start">{glyphNode(actionIcon)}</span>
              ) : null}
              {action}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Feedback/Alert',
  component: AlertStory,
  args: {
    tone: 'danger',
    appearance: 'banner',
    icon: 'none',
    title: '',
    text: 'Something went wrong. Please try again.',
    action: '',
    actionIcon: 'none',
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['danger', 'warning', 'info', 'success', 'indigo', 'neutral'],
    },
    appearance: { control: 'inline-radio', options: ['banner', 'callout'] },
    icon: glyphControl,
    actionIcon: glyphControl,
  },
} satisfies Meta<typeof AlertStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const OnHoldBanner: Story = {
  args: {
    tone: 'info',
    icon: 'pause',
    title: 'Student is on a break',
    text: 'No new lessons are planned while the student is on a break.',
    action: 'End the break',
    actionIcon: 'play',
  },
};

export const ArchivedBanner: Story = {
  args: {
    tone: 'warning',
    icon: 'archive',
    title: 'This student is archived',
    text: 'The profile and history stay readable. Restore the student to plan lessons again.',
    action: 'Restore',
    actionIcon: 'restore',
  },
};

export const Callout: Story = {
  args: {
    tone: 'warning',
    appearance: 'callout',
    title: 'Late cancellation',
    text: '3 hours before the start — within the 24-hour deadline. We suggest charging the lesson.',
  },
};
